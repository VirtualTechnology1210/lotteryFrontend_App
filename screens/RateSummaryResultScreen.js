import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Alert,
    Platform,
    TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { reportService } from '../services/reportService';
import PrinterService from '../printer/PrinterService';
import { formatRateSummaryReportReceipt } from '../printer/cpclReceiptFormatter';
import { ToastAndroid } from 'react-native';

const RateSummaryResultScreen = ({ navigation, route }) => {
    const { filters } = route.params || {};
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await reportService.getRateSummaryReport(filters);
            if (response && response.data) {
                setReportData(response.data.report || []);
                setSummary(response.data.overall_summary || null);
            }
        } catch (error) {
            console.error('Fetch rate summary error:', error);
            Alert.alert('Error', 'Failed to load report data');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const processPrintReport = async () => {
        setIsPrinting(true);
        try {
            const receiptBytes = formatRateSummaryReportReceipt({
                fromDate: filters?.start_date || null,
                toDate: filters?.end_date || null,
                username: route.params?.userName || null,
                reportItems: reportData,
                summary: summary,
            }, '80');

            await PrinterService.printWithPersistentConnection(receiptBytes);

            if (Platform.OS === 'android') {
                ToastAndroid.show('Report printed successfully!', ToastAndroid.SHORT);
            }
        } catch (error) {
            console.error('[Print Report] Error:', error);
            const msg = error.message || 'Failed to print report';

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
    };

    const handlePrintReport = () => {
        if (reportData.length === 0) {
            Alert.alert('No Data', 'No data to print.');
            return;
        }

        Alert.alert(
            'Print Report',
            `Are you sure you want to print the rate summary report?\n(${reportData.length} rates)`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Print',
                    onPress: processPrintReport
                }
            ]
        );
    };

    const renderHeader = () => (
        <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colRate]}>Rate</Text>
            <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Total Amount</Text>
        </View>
    );

    const renderItem = ({ item }) => (
        <View style={styles.tableRow}>
            <Text style={[styles.rowText, styles.colRate]}>₹{Math.round(item.rate)}</Text>
            <Text style={[styles.rowText, styles.colQty]}>{item.total_quantity}</Text>
            <Text style={[styles.rowText, styles.colTotal, styles.amountText]}>₹{Math.round(item.total_amount)}</Text>
        </View>
    );

    const renderSummary = () => {
        if (!summary) return null;
        return (
            <View style={styles.summaryContainer}>
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <MaterialCommunityIcons name="package-variant" size={24} color="#15803d" />
                            <Text style={styles.summaryValue}>{summary.total_quantity}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>Total Qtys</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <MaterialCommunityIcons name="cash-multiple" size={24} color="#c2410c" />
                            <Text style={styles.summaryValue}>₹{Math.round(summary.total_amount)}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>Total Amount</Text>
                    </View>
                </View>
            </View>
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
                    <Text style={styles.headerTitle}>Rate Summary Result</Text>
                    <TouchableOpacity
                        onPress={handlePrintReport}
                        style={styles.printButton}
                        disabled={isPrinting || isLoading || reportData.length === 0}
                    >
                        {isPrinting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <MaterialCommunityIcons name="printer" size={22} color="#fff" />
                        )}
                    </TouchableOpacity>
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
                    keyExtractor={(item, index) => index.toString()}
                    contentContainerStyle={styles.listContainer}
                    ListHeaderComponent={() => (
                        <View>
                            {renderSummary()}
                            {renderHeader()}
                        </View>
                    )}
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
    printButton: {
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
        marginBottom: 20,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 16,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#3a48c2',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    headerText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    tableRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        alignItems: 'center',
    },
    rowText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    colRate: {
        flex: 1,
    },
    colQty: {
        width: 80,
        textAlign: 'center',
    },
    colTotal: {
        width: 120,
        textAlign: 'right',
    },
    amountText: {
        color: '#15803d',
        fontWeight: 'bold',
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

export default RateSummaryResultScreen;
