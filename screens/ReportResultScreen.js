import React, { useState, useEffect, useCallback, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Alert,
    Platform,
    TouchableOpacity
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { reportService } from '../services/reportService';

// Memoized Report Item for FlatList performance
const ReportItem = memo(({ item, formatDateTime, navigation }) => {
    const [expanded, setExpanded] = useState(false);

    const handleEditSingle = (saleItem) => {
        navigation.navigate('SaleEdit', {
            saleId: saleItem.id,
            saleData: saleItem,
            isMultiple: false,
        });
    };

    const handleEditGroup = () => {
        navigation.navigate('SaleEdit', {
            isMultiple: true,
            salesItems: item.items,
            groupTotal: item.total,
        });
    };

    if (item.isGroup) {
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setExpanded(!expanded)}
                style={styles.reportCard}
            >
                <View style={styles.reportHeader}>
                    <View style={styles.headerLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <MaterialCommunityIcons name="basket-outline" size={20} color="#3a48c2" style={{ marginRight: 6 }} />
                            <Text style={styles.productName}>{item.items.length} - Items </Text>
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.totalAmount}>₹{item.total.toFixed(2)}</Text>
                    </View>
                </View>

                {expanded && (
                    <View style={styles.groupDetails}>
                        <View style={styles.divider} />
                        {item.items.map((subItem, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={styles.subItemRow}
                                onPress={() => handleEditSingle(subItem)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subItemName}>{subItem.product_name}</Text>
                                    <Text style={styles.subItemMeta}>
                                        {subItem.qty} x ₹{subItem.unit_price ? subItem.unit_price.toFixed(2) : '0.00'}
                                    </Text>
                                    {subItem.desc ? (
                                        <Text style={styles.subItemDesc} numberOfLines={1}>Note: {subItem.desc}</Text>
                                    ) : null}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={styles.subItemTotal}>₹{parseFloat(subItem.total).toFixed(2)}</Text>
                                    <MaterialCommunityIcons name="pencil-outline" size={14} color="#3a48c2" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={styles.reportFooter}>
                    <View style={styles.metaRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color="#888" />
                        <Text style={styles.footerText}>{formatDateTime(item.created_at)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#3a48c2', marginRight: 4 }}>
                                {expanded ? 'Hide Details' : 'View Details'}
                            </Text>
                            <MaterialCommunityIcons
                                name={expanded ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#3a48c2"
                            />
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
                <View style={styles.headerLeft}>
                    <Text style={styles.productName}>{item.product_name}</Text>
                    {item.product_code && (
                        <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>{item.product_code}</Text>
                        </View>
                    )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.totalAmount}>₹{parseFloat(item.total).toFixed(2)}</Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.reportDetails}>
                <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Unit Price</Text>
                        <Text style={styles.detailValue}>₹{item.unit_price ? item.unit_price.toFixed(2) : '0.00'}</Text>
                    </View>
                    <View style={[styles.detailItem, { alignItems: 'center' }]}>
                        <Text style={styles.detailLabel}>Quantity</Text>
                        <Text style={styles.detailValue}>{item.qty}</Text>
                    </View>
                    <View style={[styles.detailItem, { alignItems: 'flex-end' }]}>
                        <Text style={styles.detailLabel}>Created By</Text>
                        <Text style={styles.userText}>{item.created_by || 'Unknown'}</Text>
                    </View>
                </View>

                {item.desc && (
                    <View style={styles.descContainer}>
                        <Text style={styles.descLabel}>Notes:</Text>
                        <Text style={styles.descText}>{item.desc}</Text>
                    </View>
                )}
            </View>

            <View style={styles.reportFooter}>
                <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#888" />
                    <Text style={styles.footerText}>{formatDateTime(item.created_at)}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => handleEditSingle(item)}
                    style={styles.editIconButton}
                >
                    <MaterialCommunityIcons name="pencil-outline" size={18} color="#3a48c2" />
                </TouchableOpacity>
            </View>
        </View>
    );
});

const ReportResultScreen = ({ navigation, route }) => {
    const { filters } = route.params || {};
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState([]);
    const [summary, setSummary] = useState(null);

    const fetchReport = useCallback(async () => {
        // Only show loading on initial load or empty data
        if (reportData.length === 0) setIsLoading(true);

        try {
            const response = await reportService.getSalesReport({
                ...filters,
                limit: 100 // Get more records to allow grouping
            });

            if (response && response.data) {
                const { report, summary: apiSummary } = response.data;
                const sales = report || [];

                // Group transactions close in time (2 seconds window)
                const groupTransactions = (transactions) => {
                    if (!transactions || transactions.length === 0) return [];

                    // Ensure sorted by time descending
                    const sorted = [...transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    const grouped = [];
                    if (sorted.length === 0) return [];

                    let currentGroup = {
                        ...sorted[0],
                        total: parseFloat(sorted[0].total),
                        items: [sorted[0]],
                        isGroup: false,
                        qty: parseInt(sorted[0].qty || 0)
                    };

                    for (let i = 1; i < sorted.length; i++) {
                        const item = sorted[i];
                        const lastItemInGroup = currentGroup.items[currentGroup.items.length - 1]; // Closest in time

                        const timeDiff = Math.abs(new Date(lastItemInGroup.created_at) - new Date(item.created_at));

                        // If within 2 seconds, assume same batch
                        if (timeDiff < 2000) {
                            currentGroup.items.push(item);
                            currentGroup.total += parseFloat(item.total);
                            currentGroup.qty += parseInt(item.qty || 0);
                            currentGroup.isGroup = true;
                        } else {
                            // Push finished group
                            grouped.push(currentGroup);
                            // Start new group
                            currentGroup = {
                                ...item,
                                total: parseFloat(item.total),
                                items: [item],
                                isGroup: false,
                                qty: parseInt(item.qty || 0)
                            };
                        }
                    }
                    grouped.push(currentGroup);
                    return grouped;
                };

                setReportData(groupTransactions(report));
                setSummary(response.data.summary || null);
            }
        } catch (error) {
            console.error('Fetch report error:', error);
            Alert.alert('Error', 'Failed to load report data');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    // Auto-refresh when screen comes into focus (after editing a sale)
    useFocusEffect(
        useCallback(() => {
            fetchReport();
        }, [fetchReport])
    );

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderSummary = () => {
        if (!summary) return null;
        return (
            <View style={styles.summaryContainer}>
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <MaterialCommunityIcons name="receipt" size={24} color="#3a48c2" />
                            <Text style={styles.summaryValue}>{summary.total_records}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>Total Sales</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <MaterialCommunityIcons name="package-variant" size={24} color="#15803d" />
                            <Text style={styles.summaryValue}>{summary.total_quantity}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>Total Qtys</Text>
                    </View>
                    <View style={[styles.summaryCard, styles.summaryCardWide]}>
                        <View style={styles.summaryRow}>
                            <MaterialCommunityIcons name="cash-multiple" size={24} color="#c2410c" />
                            <Text style={styles.summaryValue}>₹{summary.total_amount.toFixed(2)}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>Total Amount</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderItem = useCallback(({ item }) => (
        <ReportItem item={item} formatDateTime={formatDateTime} navigation={navigation} />
    ), [navigation]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#3a48c2', '#2a38a0', '#192f6a']}
                style={styles.headerBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Decorative Elements */}
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />

                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Sales Report Result</Text>
                    <View style={styles.addButtonPlaceholder} />
                </View>
            </LinearGradient>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3a48c2" />
                    <Text style={styles.loadingText}>Generating Report...</Text>
                </View>
            ) : (
                <FlatList
                    data={reportData}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    ListHeaderComponent={renderSummary}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="file-alert-outline" size={60} color="#ddd" />
                            <Text style={styles.emptyText}>No sales found</Text>
                            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
                        </View>
                    }
                />
            )}
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
        paddingBottom: 26,
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
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    addButtonPlaceholder: {
        width: 44,
        height: 44,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 16,
    },
    listContainer: {
        padding: 16,
    },
    summaryContainer: {
        marginBottom: 10,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    summaryCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 12,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    summaryCardWide: {
        minWidth: '100%',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
        gap: 6,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    summaryLabel: {
        fontSize: 11,
        color: '#666',
    },
    reportCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerLeft: {
        flex: 1,
        marginRight: 10,
    },
    productName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    codeBadge: {
        backgroundColor: '#EEF0FF',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    codeText: {
        fontSize: 11,
        color: '#3a48c2',
        fontWeight: '600',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15803d',
    },
    divider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 12,
    },
    reportDetails: {
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailItem: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    descContainer: {
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
    },
    descLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 2,
    },
    descText: {
        fontSize: 13,
        color: '#444',
        fontStyle: 'italic',
    },
    metaInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f5f5f5',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#666',
    },
    userText: {
        fontWeight: '600',
        color: '#3a48c2',
    },
    reportFooter: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#888',
        marginLeft: 4,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#999',
        marginTop: 15,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#bbb',
        marginTop: 5,
    },
    groupDetails: {
        backgroundColor: '#F8F9FD',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
    },
    subItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    subItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    subItemMeta: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    subItemTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#15803d',
    },
    subItemDesc: {
        fontSize: 11,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 2,
    },
    editIconButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(58, 72, 194, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    editAllText: {
        fontSize: 12,
        color: '#3a48c2',
        fontWeight: '600',
    },
});

export default ReportResultScreen;
