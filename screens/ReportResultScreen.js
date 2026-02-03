import React, { useState, useEffect, useCallback, memo } from 'react';
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
const ReportItem = memo(({ item, formatDateTime }) => (
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
                <Text style={styles.totalAmount}>₹{item.total.toFixed(2)}</Text>
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
        </View>
    </View>
));

const ReportResultScreen = ({ navigation, route }) => {
    const { filters } = route.params || {};
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState([]);
    const [summary, setSummary] = useState(null);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await reportService.getSalesReport(filters);

            if (response && response.data) {
                setReportData(response.data.report || []);
                setSummary(response.data.summary || null);
            }
        } catch (error) {
            console.error('Fetch report error:', error);
            Alert.alert('Error', 'Failed to load report data');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

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
        <ReportItem item={item} formatDateTime={formatDateTime} />
    ), []);

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#3a48c2', '#2a38a0']}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Sales Report Result</Text>
                    <View style={styles.backButton} />
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
    header: {
        paddingTop: Platform.OS === 'android' ? 20 : 20,
        paddingBottom: 15,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backButton: {
        padding: 5,
        width: 40,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
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
});

export default ReportResultScreen;
