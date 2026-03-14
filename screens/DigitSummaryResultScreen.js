import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    RefreshControl,
    ToastAndroid,
    Alert,
    FlatList,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { reportService } from '../services/reportService';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';

// Helper to format comma-separated lottery numbers into a vertical list
const formatDescForUI = (desc) => {
    if (!desc) return '-';
    return desc.split(',').map(n => n.trim()).filter(Boolean).join('\n');
};

// Memoized components for better performance
const DigitRow = React.memo(({ item, index, isLast, formatCurrency }) => (
    <View style={[styles.tableRow, isLast && styles.tableRowLast]}>
        <Text style={[styles.tableCell, { flex: 0.4, color: '#9CA3AF' }]}>{index + 1}</Text>
        <Text style={[styles.tableCellLottery, { flex: 1.5 }]}>{formatDescForUI(item.desc)}</Text>
        <Text style={[styles.tableCell, { flex: 1.2 }]} numberOfLines={1}>{item.product_name || item.product_code || '-'}</Text>
        <Text style={[styles.tableCellQty, { flex: 0.6, textAlign: 'center' }]}>{item.qty || 0}</Text>
        <Text style={[styles.tableCellAmount, { flex: 1.3, textAlign: 'right' }]}>{formatCurrency(item.total)}</Text>
    </View>
));

const DigitGroupHeader = React.memo(({ digitCount, items, isExpanded, onToggle, formatCurrency }) => {
    const totalQty = items.reduce((sum, i) => sum + (parseInt(i.qty) || 0), 0);
    const totalAmount = items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggle}
            style={[
                styles.userCardHeader,
                { borderBottomWidth: isExpanded ? 1 : 0, paddingBottom: isExpanded ? 10 : 0 }
            ]}
        >
            <View style={styles.groupHeaderLeft}>
                <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{digitCount}D</Text>
                </View>
                <View>
                    <Text style={styles.userCardName}>{digitCount}-Digit Numbers</Text>
                    <Text style={styles.userCardSubtitle}>{items.length} entries</Text>
                </View>
            </View>
            <View style={styles.groupHeaderRight}>
                <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                    <Text style={styles.groupQtyLabel}>Qty: <Text style={styles.groupQtyValue}>{totalQty}</Text></Text>
                    <Text style={styles.groupAmount}>{formatCurrency(totalAmount)}</Text>
                </View>
                <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#3a48c2"
                />
            </View>
        </TouchableOpacity>
    );
});

const DigitSummaryResultScreen = ({ navigation, route }) => {
    const { filters } = route.params || {};
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [salesData, setSalesData] = useState([]);
    const [digitGroups, setDigitGroups] = useState({});
    const [expandedGroups, setExpandedGroups] = useState({});
    const [summary, setSummary] = useState(null);

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const isSameDay = filters?.start_date && filters?.end_date && filters.start_date === filters.end_date;
    const dateRangeText = filters?.start_date && filters?.end_date
        ? isSameDay ? formatDisplayDate(filters.start_date) : `${formatDisplayDate(filters.start_date)} — ${formatDisplayDate(filters.end_date)}`
        : formatDisplayDate(new Date().toISOString());

    // Group sales by digit count of the lottery number (desc field)
    const groupByDigitCount = (sales) => {
        const groups = { 4: [], 3: [], 2: [], 1: [] };

        sales.forEach(item => {
            const lotteryNumber = (item.desc || '').trim();
            if (!lotteryNumber) return;

            // Box products have comma-separated values like '123, 132, 213'.
            // Extract only the first number to determine the digit count.
            const firstLotteryNumber = lotteryNumber.split(',')[0].trim();

            // Extract only digits from the first number
            const digitsOnly = firstLotteryNumber.replace(/\D/g, '');
            const digitCount = digitsOnly.length;

            if (digitCount >= 4) {
                groups[4].push(item);
            } else if (digitCount === 3) {
                groups[3].push(item);
            } else if (digitCount === 2) {
                groups[2].push(item);
            } else if (digitCount === 1) {
                groups[1].push(item);
            }
        });

        return groups;
    };

    const fetchData = useCallback(async (showLoader = true) => {
        if (showLoader) setIsLoading(true);

        try {
            const response = await reportService.getSalesReport({
                ...filters,
                limit: 500,
            });

            if (response && response.data) {
                const sales = response.data.report || [];
                setSalesData(sales);
                setDigitGroups(groupByDigitCount(sales));
                setSummary(response.data.summary || null);
            }
        } catch (error) {
            console.error('Fetch digit summary error:', error);
            Alert.alert('Error', 'Failed to load sales data');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData(false);
    };

    const toggleGroup = useCallback((digit) => {
        setExpandedGroups(prev => ({
            ...prev,
            [digit]: !prev[digit]
        }));
    }, []);

    const formatCurrency = useCallback((amount) => {
        return `${Math.round(parseFloat(amount) || 0).toLocaleString('en-IN')}`;
    }, []);

    // Generate A4 PDF and share via WhatsApp
    const handleWhatsAppShare = async () => {
        if (salesData.length === 0) {
            Alert.alert('No Data', 'No sales data to share.');
            return;
        }

        setIsSharing(true);
        try {
            // Build HTML sections for each digit group
            const buildGroupSection = (digitCount, items) => {
                if (items.length === 0) return '';

                const totalQty = items.reduce((sum, i) => sum + (parseInt(i.qty) || 0), 0);
                const totalAmount = items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);

                const rows = items.map((item, index) => {
                    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fd';
                    const lotteryFormatted = (item.desc || '-').split(',').map(n => n.trim()).filter(Boolean).join('<br/>');
                    return `
                        <tr style="background-color: ${bgColor};">
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #555; vertical-align: top;">${index + 1}</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 14px; color: #1a1a1a; font-weight: 600; letter-spacing: 1px; vertical-align: top; line-height: 1.5;">${lotteryFormatted}</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #555; vertical-align: top;">${item.product_name || item.product_code || '-'}</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: center; font-weight: 600; vertical-align: top;">${item.qty || 0}</td>
                            <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #189b39; text-align: right; font-weight: 700; vertical-align: top;">${Math.round(parseFloat(item.total) || 0)}</td>
                        </tr>
                    `;
                }).join('');

                return `
                    <div style="margin-bottom: 24px;">
                        <div style="background: #3a48c2; padding: 12px 18px; border-radius: 8px 8px 0 0; margin-bottom: 0; page-break-after: avoid;">
                            <span style="font-size: 15px; font-weight: 700; color: #fff;">${digitCount}-Digit Numbers</span>
                            <span style="float: right; font-size: 13px; color: #fff; font-weight: 600;">${items.length} items | Qty: ${totalQty} | ${Math.round(totalAmount)}</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border-radius: 0 0 8px 8px; overflow: hidden; border: 1px solid #eee;">
                            <thead>
                                <tr style="background: #f0f2ff;">
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: left;">#</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: left;">Lottery No</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: left;">Product</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: center;">Qty</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
            };

            const totalEntries = Object.values(digitGroups).reduce((s, g) => s + g.length, 0);
            const totalQtyAll = salesData.reduce((s, i) => s + (parseInt(i.qty) || 0), 0);
            const totalAmtAll = salesData.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);

            const htmlContent = `
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            color: #222;
                            margin: 0;
                            padding: 0;
                        }
                    </style>
                </head>
                <body>
                    <div style="background: linear-gradient(135deg, #3a48c2, #192f6a); color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;">
                        <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Digit Summary Report</h1>
                        <p style="margin: 0; font-size: 14px; opacity: 0.85;">${dateRangeText}</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; background: #fff; border: 1px solid #f0f0f5; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; font-size: 15px;">
                        <span>Total Entries: <strong style="color: #3a48c2;">${totalEntries}</strong></span>
                        <span>Total Qty: <strong style="color: #3a48c2;">${totalQtyAll}</strong></span>
                        <span>Total Amount: <strong style="color: #189b39;">${Math.round(totalAmtAll)}</strong></span>
                    </div>

                    ${buildGroupSection(4, digitGroups[4] || [])}
                    ${buildGroupSection(3, digitGroups[3] || [])}
                    ${buildGroupSection(2, digitGroups[2] || [])}
                    ${buildGroupSection(1, digitGroups[1] || [])}
                </body>
                </html>
            `;

            const pdfOptions = {
                html: htmlContent,
                fileName: `Digit_Summary_${Date.now()}`,
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
                    title: 'Digit Summary Report',
                    message: `Digit Summary Report (${dateRangeText})`,
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

    const totalEntries = useMemo(() =>
        Object.values(digitGroups).reduce((s, g) => s + g.length, 0),
        [digitGroups]);

    // Flattening the data for FlatList to enable virtualization
    const flattenedListData = useMemo(() => {
        if (totalEntries === 0) return [{ type: 'empty' }];

        const data = [];
        // Header info
        data.push({ type: 'overall_card' });
        data.push({ type: 'section_header' });

        [4, 3, 2, 1].forEach(d => {
            const items = digitGroups[d] || [];
            if (items.length > 0) {
                const isExpanded = !!expandedGroups[d];
                data.push({ type: 'group_header', digit: d, items, isExpanded });

                if (isExpanded) {
                    data.push({ type: 'table_header' });
                    items.forEach((item, index) => {
                        data.push({
                            type: 'group_row',
                            digit: d,
                            item,
                            index,
                            isLast: index === items.length - 1
                        });
                    });
                }
            }
        });

        return data;
    }, [digitGroups, expandedGroups, totalEntries]);

    const renderListData = ({ item }) => {
        switch (item.type) {
            case 'overall_card':
                return (
                    <View style={styles.overallCard}>
                        <View style={styles.overallCardHeader}>
                            <MaterialCommunityIcons name="chart-box-outline" size={20} color="#3a48c2" />
                            <Text style={styles.overallCardTitle}>Overall Summary</Text>
                        </View>

                        <View style={styles.overallGrid}>
                            <View style={styles.overallItem}>
                                <Text style={styles.overallItemLabel}>Total Entries</Text>
                                <Text style={[styles.overallItemValue, { color: '#3a48c2' }]}>
                                    {totalEntries}
                                </Text>
                            </View>

                            <View style={styles.overallDivider} />

                            <View style={styles.overallItem}>
                                <Text style={styles.overallItemLabel}>Total Qty</Text>
                                <Text style={[styles.overallItemValue, { color: '#1a1a1a' }]}>
                                    {salesData.reduce((s, i) => s + (parseInt(i.qty) || 0), 0)}
                                </Text>
                            </View>

                            <View style={styles.overallDivider} />

                            <View style={styles.overallItem}>
                                <Text style={styles.overallItemLabel}>Total Amount</Text>
                                <Text style={[styles.overallItemValue, { color: '#189b39' }]}>
                                    {formatCurrency(salesData.reduce((s, i) => s + (parseFloat(i.total) || 0), 0))}
                                </Text>
                            </View>
                        </View>
                    </View>
                );
            case 'section_header':
                return (
                    <View style={styles.userSectionHeader}>
                        <MaterialCommunityIcons name="format-list-numbered" size={20} color="#3a48c2" />
                        <Text style={styles.userSectionTitle}>Digit-wise Breakup</Text>
                    </View>
                );
            case 'group_header':
                return (
                    <View style={[styles.userCard, item.isExpanded && { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                        <DigitGroupHeader
                            digitCount={item.digit}
                            items={item.items}
                            isExpanded={item.isExpanded}
                            onToggle={() => toggleGroup(item.digit)}
                            formatCurrency={formatCurrency}
                        />
                    </View>
                );
            case 'table_header':
                return (
                    <View style={[styles.userCard, { marginTop: 0, paddingTop: 0, marginBottom: 0, borderRadius: 0, elevation: 2 }]}>
                        <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderText, { flex: 0.4 }]}>No</Text>
                            <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Lottery</Text>
                            <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Product</Text>
                            <Text style={[styles.tableHeaderText, { flex: 0.6, textAlign: 'center' }]}>Qty</Text>
                            <Text style={[styles.tableHeaderText, { flex: 1.3, textAlign: 'right' }]}>Amount</Text>
                        </View>
                    </View>
                );
            case 'group_row':
                return (
                    <View style={[
                        styles.userCard,
                        { marginTop: 0, paddingTop: 0, borderRadius: 0, marginBottom: 0, elevation: 2 },
                        item.isLast && { borderBottomLeftRadius: 14, borderBottomRightRadius: 14, marginBottom: 10, paddingBottom: 10 }
                    ]}>
                        <DigitRow
                            item={item.item}
                            index={item.index}
                            isLast={item.isLast}
                            formatCurrency={formatCurrency}
                        />
                    </View>
                );
            case 'empty':
                return (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="numeric-off" size={60} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>No Numbers Found</Text>
                        <Text style={styles.emptyText}>No lottery numbers match your filters.</Text>
                    </View>
                );
            default:
                return null;
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
                    <Text style={styles.headerTitle}>Digit Summary</Text>
                    <View style={styles.headerPlaceholder} />
                </View>

                {/* Date Range Badge */}
                <View style={styles.dateRangeBadge}>
                    <MaterialCommunityIcons name="calendar-range" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.dateRangeText}>{dateRangeText}</Text>
                </View>
            </LinearGradient>

            {isLoading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3a48c2" />
                    <Text style={styles.loadingText}>Analyzing digits...</Text>
                </View>
            ) : (
                <FlatList
                    data={flattenedListData}
                    renderItem={renderListData}
                    keyExtractor={(item, index) => {
                        if (item.type === 'group_row') return `row-${item.digit}-${item.index}`;
                        if (item.type === 'group_header') return `header-${item.digit}`;
                        return `${item.type}-${index}`;
                    }}
                    contentContainerStyle={styles.flatListContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#3a48c2']}
                        />
                    }
                />
            )}

            {/* WhatsApp Floating Action Button */}
            <TouchableOpacity
                style={styles.whatsappFab}
                onPress={handleWhatsAppShare}
                activeOpacity={0.8}
                disabled={isSharing || isLoading || salesData.length === 0}
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
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    headerPlaceholder: {
        width: 44,
        height: 44,
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
    flatListContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    scrollView: {
        flex: 1,
    },
    centerContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#888',
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
    // ── Groups Section ──────────────────────────────────────────
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
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomColor: '#F5F5FA',
    },
    groupHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
        fontSize: 13,
        fontWeight: 'bold',
        color: '#fff',
    },
    userCardName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    userCardSubtitle: {
        fontSize: 12,
        color: '#888',
        marginTop: 1,
    },
    groupHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupQtyLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 2,
    },
    groupQtyValue: {
        fontWeight: '700',
        color: '#1a1a1a',
    },
    groupAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#189b39',
    },
    // ── Group Content (Table) ───────────────────────────────────
    groupContent: {
        marginTop: 4,
        paddingTop: 8,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F5',
        marginBottom: 6,
    },
    tableHeaderText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#888',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5FA',
        alignItems: 'center',
    },
    tableRowLast: {
        borderBottomWidth: 0,
        paddingBottom: 2,
    },
    tableCell: {
        fontSize: 13,
        color: '#444',
    },
    tableCellLottery: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    tableCellQty: {
        fontSize: 13,
        fontWeight: '600',
        color: '#444',
    },
    tableCellAmount: {
        fontSize: 13,
        fontWeight: '700',
        color: '#189b39',
    },
    emptyGroupContent: {
        alignItems: 'center',
        paddingVertical: 20,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F5F5FA',
    },
    emptyGroupText: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 6,
    },
    // ── WhatsApp FAB ─────────────────────────────────────────────
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
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        zIndex: 999,
    },
});

export default DigitSummaryResultScreen;
