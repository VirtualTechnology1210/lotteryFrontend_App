import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    RefreshControl,
    Alert,
    ToastAndroid
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { winningService } from '../services/winningService';
import PrinterService from '../printer/PrinterService';
import { formatWinningSummaryReceipt } from '../printer/cpclReceiptFormatter';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';

const WinningSummaryResultScreen = ({ navigation, route }) => {
    // Get filter params from navigation (same pattern as ReportResultScreen)
    const filters = route.params?.filters || {};
    const startDate = filters.start_date || new Date().toISOString().split('T')[0];
    const endDate = filters.end_date || startDate;
    const categoryId = filters.category_id || null;
    const categoryName = filters.category_name || null;

    // Data state
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);


    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const fetchSummary = useCallback(async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        setError(null);

        try {
            const response = await winningService.getWinningSummary(startDate, endDate, categoryId);

            if (response?.data) {
                setSummary(response.data);
            }
        } catch (err) {
            console.error('Fetch summary error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load summary');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [startDate, endDate, categoryId]);

    // Fetch on mount
    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchSummary(false);
    };


    const isSameDay = startDate === endDate;
    const dateRangeLabel = isSameDay
        ? formatDisplayDate(startDate)
        : `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;

    const formatCurrency = (amount) => {
        return '₹' + (amount || 0).toLocaleString('en-IN');
    };

    // Print the winning summary receipt
    const handlePrintSummary = () => {
        if (!summary) {
            Alert.alert('No Data', 'No summary data to print.');
            return;
        }

        Alert.alert(
            'Print Summary',
            'Are you sure you want to print the winning summary?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Print',
                    onPress: async () => {
                        setIsPrinting(true);
                        try {
                            const receiptBytes = formatWinningSummaryReceipt({
                                fromDate: startDate,
                                toDate: endDate,
                                summary: summary,
                            }, '80');

                            await PrinterService.printWithPersistentConnection(receiptBytes);

                            if (Platform.OS === 'android') {
                                ToastAndroid.show('Summary printed successfully!', ToastAndroid.SHORT);
                            }
                        } catch (error) {
                            console.error('[Print Summary] Error:', error);
                            const msg = error.message || 'Failed to print summary';

                            if (msg.includes('No printer configured')) {
                                Alert.alert(
                                    'No Printer',
                                    'No printer configured. Would you like to set up a printer?',
                                    [
                                        { text: 'Later', style: 'cancel' },
                                        { text: 'Setup', onPress: () => navigation.navigate('PrinterSettings') }
                                    ]
                                );
                            } else if (Platform.OS === 'android') {
                                ToastAndroid.show(`Print: ${msg}`, ToastAndroid.LONG);
                            }
                        } finally {
                            setIsPrinting(false);
                        }
                    }
                }
            ]
        );
    };

    // Generate A4 PDF and share via WhatsApp
    const handleWhatsAppShare = async () => {
        if (!summary || (summary.total_entries === 0 && (summary.total_sales_amount || 0) === 0)) {
            Alert.alert('No Data', 'No summary data to share.');
            return;
        }

        setIsSharing(true);
        try {
            let userRows = '';
            if (summary.user_wise && summary.user_wise.length > 0) {
                userRows = summary.user_wise.map((user, index) => {
                    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fd';
                    return `
                        <tr style="background-color: ${bgColor};">
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #555;">${index + 1}</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 14px; color: #1a1a1a; font-weight: 600;">${user.user_name || '-'}</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #3a48c2; text-align: right; font-weight: 600;">${Math.round(parseFloat(user.total_sales) || 0).toLocaleString('en-IN')}</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #189b39; text-align: right; font-weight: 600;">${Math.round(parseFloat(user.total_winning) || 0).toLocaleString('en-IN')}</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #dc2626; text-align: right; font-weight: 700;">${Math.round(parseFloat(user.balance) || 0).toLocaleString('en-IN')}</td>
                        </tr>
                    `;
                }).join('');
            }

            const htmlContent = `
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 0; }
                    </style>
                </head>
                <body>
                    <div style="background: linear-gradient(135deg, #3a48c2, #192f6a); color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;">
                        <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Winning Summary Report</h1>
                        <p style="margin: 0; font-size: 14px; opacity: 0.85;">${dateRangeLabel} | ${categoryName || 'All Categories'}</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; background: #fff; border: 1px solid #f0f0f5; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; font-size: 15px;">
                        <span>Total Sales: <strong style="color: #3a48c2;">${formatCurrency(summary.total_sales_amount)}</strong></span>
                        <span>Total Winning: <strong style="color: #189b39;">${formatCurrency(summary.total_winning_amount)}</strong></span>
                        <span>Balance: <strong style="color: #dc2626;">${formatCurrency(summary.total_balance)}</strong></span>
                    </div>

                    ${userRows ? `
                    <div style="margin-bottom: 24px;">
                        <div style="background: #3a48c2; padding: 12px 18px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
                            <span style="font-size: 15px; font-weight: 700; color: #fff;">User-wise Split</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border-radius: 0 0 8px 8px; overflow: hidden; border: 1px solid #eee;">
                            <thead>
                                <tr style="background: #f0f2ff;">
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: left;">#</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: left;">User</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: right;">Sales</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: right;">Winning</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: right;">Balance</th>
                                </tr>
                            </thead>
                            <tbody>${userRows}</tbody>
                        </table>
                    </div>
                    ` : ''}
                </body>
                </html>
            `;

            const pdfOptions = {
                html: htmlContent,
                fileName: `Winning_Summary_${Date.now()}`,
                directory: 'Documents',
                base64: false,
                height: 842,
                width: 595,
            };

            const pdf = await RNHTMLtoPDF.convert(pdfOptions);

            if (pdf.filePath) {
                await Share.open({
                    url: `file://${pdf.filePath}`,
                    type: 'application/pdf',
                    social: Share.Social.WHATSAPP,
                    title: 'Winning Summary Report',
                    message: `Winning Summary Report (${dateRangeLabel})`,
                });
            }
        } catch (error) {
            if (error?.message !== 'User did not share' && !error?.message?.includes('dismiss')) {
                console.error('[WhatsApp Share] Error:', error);
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Failed to share report', ToastAndroid.SHORT);
                }
            }
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#3a48c2', '#2a38a0', '#192f6a']}
                style={styles.headerBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />

                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Winning Summary</Text>
                    <TouchableOpacity
                        onPress={handlePrintSummary}
                        style={styles.printButton}
                        disabled={isPrinting || isLoading || !summary}
                    >
                        {isPrinting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <MaterialCommunityIcons name="printer" size={22} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Date Range Badge */}
                <View style={styles.dateRangeBadge}>
                    <MaterialCommunityIcons name="calendar-range" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.dateRangeText}>{dateRangeLabel}</Text>
                </View>

                {/* Category Badge */}
                <View style={styles.categoryBadge}>
                    <MaterialCommunityIcons name="shape" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.categoryBadgeText}>
                        {categoryName || 'All Categories'}
                    </Text>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#3a48c2']} />
                }
            >
                {/* Loading */}
                {isLoading && (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#3a48c2" />
                        <Text style={styles.loadingText}>Loading summary...</Text>
                    </View>
                )}

                {/* Error */}
                {error && (
                    <View style={styles.errorContainer}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#dc2626" />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={() => fetchSummary()}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* No Data — only show when no winning entries AND no sales */}
                {!isLoading && !error && summary && summary.total_entries === 0 && (summary.total_sales_amount || 0) === 0 && (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="trophy-broken" size={60} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>No Winning Entries</Text>
                        <Text style={styles.emptyText}>
                            No winning entries have been submitted for {dateRangeLabel}.
                        </Text>
                    </View>
                )}

                {/* Summary Data — show when there's any data (sales or winning) */}
                {!isLoading && !error && summary && ((summary.total_entries > 0) || (summary.total_sales_amount || 0) > 0) && (
                    <View style={styles.summaryContainer}>

                        {/* ── Overall Summary Card ── */}
                        <View style={styles.overallCard}>
                            <View style={styles.overallCardHeader}>
                                <MaterialCommunityIcons name="chart-box-outline" size={20} color="#3a48c2" />
                                <Text style={styles.overallCardTitle}>Overall Summary</Text>
                            </View>

                            <View style={styles.overallGrid}>
                                <View style={styles.overallItem}>
                                    <Text style={styles.overallItemLabel}>Total Sales</Text>
                                    <Text style={[styles.overallItemValue, { color: '#3a48c2' }]}>
                                        {formatCurrency(summary.total_sales_amount)}
                                    </Text>
                                </View>

                                <View style={styles.overallDivider} />

                                <View style={styles.overallItem}>
                                    <Text style={styles.overallItemLabel}>Total Winning</Text>
                                    <Text style={[styles.overallItemValue, { color: '#189b39ff' }]}>
                                        {formatCurrency(summary.total_winning_amount)}
                                    </Text>
                                </View>

                                <View style={styles.overallDivider} />

                                <View style={styles.overallItem}>
                                    <Text style={styles.overallItemLabel}>Balance</Text>
                                    <Text style={[styles.overallItemValue, { color: '#dc2626' }]}>
                                        {formatCurrency(summary.total_balance)}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* ── User-wise Split Section ── */}
                        {summary.user_wise && summary.user_wise.length > 0 && (
                            <View style={styles.userSectionContainer}>
                                <View style={styles.userSectionHeader}>
                                    <MaterialCommunityIcons name="account-group-outline" size={20} color="#3a48c2" />
                                    <Text style={styles.userSectionTitle}>User-wise Split</Text>
                                </View>

                                {summary.user_wise.map((user, index) => (
                                    <View key={index} style={styles.userCard}>
                                        {/* User Name Header */}
                                        <View style={styles.userCardHeader}>
                                            <View style={styles.userAvatar}>
                                                <Text style={styles.userAvatarText}>
                                                    {(user.user_name || '?').charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={styles.userCardName}>{user.user_name}</Text>
                                        </View>

                                        {/* User Stats Row */}
                                        <View style={styles.userStatsRow}>
                                            <View style={styles.userStatItem}>
                                                <Text style={styles.userStatLabel}>Sales</Text>
                                                <Text style={[styles.userStatValue, { color: '#3a48c2' }]}>
                                                    {formatCurrency(user.total_sales)}
                                                </Text>
                                            </View>

                                            <View style={styles.userStatDivider} />

                                            <View style={styles.userStatItem}>
                                                <Text style={styles.userStatLabel}>Winning</Text>
                                                <Text style={[styles.userStatValue, { color: '#189b39ff' }]}>
                                                    {formatCurrency(user.total_winning)}
                                                </Text>
                                            </View>

                                            <View style={styles.userStatDivider} />

                                            <View style={styles.userStatItem}>
                                                <Text style={styles.userStatLabel}>Balance</Text>
                                                <Text style={[styles.userStatValue, { color: '#dc2626' }]}>
                                                    {formatCurrency(user.balance)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                    </View>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>

            {/* WhatsApp Floating Action Button */}
            <TouchableOpacity
                style={styles.whatsappFab}
                onPress={handleWhatsAppShare}
                activeOpacity={0.8}
                disabled={isSharing || isLoading || !summary || (summary.total_entries === 0 && (summary.total_sales_amount || 0) === 0)}
            >
                {isSharing ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <MaterialCommunityIcons name="whatsapp" size={28} color="#fff" />
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    headerBackground: {
        paddingTop: Platform.OS === 'android' ? 20 : 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden',
        zIndex: 1,
    },
    decorativeCircle1: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        top: -50,
        right: -50,
    },
    decorativeCircle2: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        top: 40,
        left: -40,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    backButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        padding: 10,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 0.5,
    },
    printButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        padding: 10,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateRangeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        marginTop: 10,
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    dateRangeText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '600',
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        marginTop: 6,
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    categoryBadgeText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    // ── Loading / Error / Empty ───────────────────────────────────
    centerContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#888',
    },
    errorContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        marginHorizontal: 20,
    },
    errorText: {
        fontSize: 14,
        color: '#dc2626',
        textAlign: 'center',
        marginTop: 10,
    },
    retryButton: {
        marginTop: 16,
        backgroundColor: '#3a48c2',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 10,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6B7280',
        marginTop: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 6,
    },
    // ── Summary Content ──────────────────────────────────────────
    summaryContainer: {
        marginHorizontal: 16,
        marginBottom: 10,
    },
    // ── Overall Summary Card ─────────────────────────────────────
    overallCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 18,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        marginBottom: 16,
    },
    overallCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F5',
    },
    overallCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    overallGrid: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    overallItem: {
        flex: 1,
        alignItems: 'center',
    },
    overallIconBg: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    overallItemLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 4,
    },
    overallItemValue: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    overallDivider: {
        width: 1,
        height: 50,
        backgroundColor: '#F0F0F5',
    },
    // ── User-wise Split ──────────────────────────────────────────
    userSectionContainer: {
        marginTop: 4,
    },
    userSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    userSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
    },
    userCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5FA',
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3a48c2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userAvatarText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
    userCardName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    userStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    userStatLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 4,
    },
    userStatValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    userStatDivider: {
        width: 1,
        height: 36,
        backgroundColor: '#F0F0F5',
    },
    whatsappFab: {
        position: 'absolute',
        bottom: 24,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#25D366',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 999,
    },
});

export default WinningSummaryResultScreen;

