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
});

export default WinningSummaryResultScreen;

