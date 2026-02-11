import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    RefreshControl,
    Dimensions,
    StatusBar,
    ActivityIndicator,
    TouchableOpacity,
    Platform
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { reportService } from '../services/reportService';
import DashboardCard from '../components/DashboardCard';
import { authService } from '../services';

const { width: screenWidth } = Dimensions.get("window");

// Memoized Transaction Item
const TransactionItem = memo(({ item, isLast }) => {
    const [expanded, setExpanded] = useState(false);

    if (item.isGroup) {
        return (
            <View style={[styles.transactionCard, isLast && styles.lastTransactionCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setExpanded(!expanded)}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                    <View style={styles.transactionIconContainer}>
                        <LinearGradient
                            colors={['#EEF0FF', '#E0E4FC']}
                            style={styles.iconGradient}
                        >
                            <MaterialCommunityIcons
                                name="basket-outline"
                                size={22}
                                color="#3a48c2"
                            />
                        </LinearGradient>
                    </View>
                    <View style={styles.transactionInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.transactionTitle} numberOfLines={1}>
                                {item.items.length} - Items
                            </Text>
                            <MaterialCommunityIcons
                                name={expanded ? "chevron-up" : "chevron-down"}
                                size={16}
                                color="#888"
                                style={{ marginLeft: 4 }}
                            />
                        </View>
                        {item.invoice_number && (
                            <Text style={styles.invoiceLabel} numberOfLines={1}>Invoice no: {item.invoice_number}</Text>
                        )}
                        <View style={styles.dateContainer}>
                            <MaterialCommunityIcons name="clock-outline" size={10} color="#888" style={{ marginRight: 3 }} />
                            <Text style={styles.transactionDate}>
                                {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.amountContainer}>
                        <Text style={styles.transactionAmount}>+₹{parseFloat(item.total).toFixed(2)}</Text>
                    </View>
                </TouchableOpacity>

                {expanded && (
                    <View style={styles.groupDetails}>
                        {item.items.map((subItem, idx) => (
                            <View key={idx} style={styles.subItemRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subItemName}>{subItem.product_name}</Text>
                                    <Text style={styles.subItemMeta}>
                                        {subItem.qty} x ₹{subItem.price || subItem.unit_price || 0}
                                    </Text>
                                </View>
                                <Text style={styles.subItemTotal}>₹{parseFloat(subItem.total).toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    }

    return (
        <View style={[styles.transactionCard, isLast && styles.lastTransactionCard]}>
            <View style={styles.transactionIconContainer}>
                <LinearGradient
                    colors={['#EEF0FF', '#E0E4FC']}
                    style={styles.iconGradient}
                >
                    <MaterialCommunityIcons name="ticket-confirmation-outline" size={22} color="#3a48c2" />
                </LinearGradient>
            </View>
            <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle} numberOfLines={1}>
                    {item.product_name || `Order #${item.id}`}
                </Text>
                {item.invoice_number && (
                    <Text style={styles.invoiceLabel} numberOfLines={1}>Invoice No: {item.invoice_number}</Text>
                )}
                <View style={styles.dateContainer}>
                    <MaterialCommunityIcons name="clock-outline" size={10} color="#888" style={{ marginRight: 3 }} />
                    <Text style={styles.transactionDate}>
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
            <View style={styles.amountContainer}>
                <Text style={styles.transactionAmount}>+₹{parseFloat(item.total).toFixed(2)}</Text>
            </View>
        </View>
    );
});

const DashboardScreen = ({ navigation, route }) => {
    const prefetchedData = route.params?.dashboardData;
    const [isLoading, setIsLoading] = useState(!prefetchedData);
    const [refreshing, setRefreshing] = useState(false);
    const hasInitiallyLoaded = useRef(false);
    const [userName, setUserName] = useState('');
    const [reportData, setReportData] = useState({
        totalSales: 0,
        totalTransactions: 0,
        averageSale: 0,
        chartData: {
            labels: ['Loading...'],
            datasets: [{ data: [0] }]
        },
        recentTransactions: []
    });

    const fetchDashboardData = useCallback(async (existingData = null) => {
        try {
            // Get user name separately
            const { user } = await authService.getAuthData();
            if (user) {
                setUserName(user.name);
            }

            // Use prefetched data if passed, otherwise fetch fresh
            const data = existingData || (await reportService.getSalesReport({ limit: 100 }))?.data;

            if (data) {
                const { summary, report } = data;
                const sales = report || [];

                // Group transactions by invoice number
                const groupTransactions = (transactions) => {
                    if (!transactions || transactions.length === 0) return [];

                    const invoiceGroups = {};
                    const noInvoiceItems = [];

                    transactions.forEach(item => {
                        if (item.invoice_number) {
                            if (!invoiceGroups[item.invoice_number]) {
                                invoiceGroups[item.invoice_number] = {
                                    invoice_number: item.invoice_number,
                                    created_at: item.created_at,
                                    items: [],
                                    total: 0,
                                    isGroup: false,
                                    id: `invoice-${item.invoice_number}`
                                };
                            }
                            invoiceGroups[item.invoice_number].items.push(item);
                            invoiceGroups[item.invoice_number].total += parseFloat(item.total || 0);
                        } else {
                            noInvoiceItems.push({
                                ...item,
                                isGroup: false,
                                items: [item],
                                total: parseFloat(item.total || 0)
                            });
                        }
                    });

                    // Mark groups with multiple items
                    Object.values(invoiceGroups).forEach(group => {
                        if (group.items.length > 1) {
                            group.isGroup = true;
                            group.id = `group-${group.invoice_number}`;
                        } else {
                            const singleItem = group.items[0];
                            Object.assign(group, singleItem);
                            group.total = parseFloat(singleItem.total);
                        }
                    });

                    const allGroups = [...Object.values(invoiceGroups), ...noInvoiceItems];
                    allGroups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    return allGroups;
                };

                const groupedSales = groupTransactions(sales);

                // Sales Trend Chart - Group by Date
                const salesByDate = {};
                sales.forEach(item => {
                    const date = new Date(item.created_at);
                    const dateKey = date.toDateString();

                    if (!salesByDate[dateKey]) {
                        salesByDate[dateKey] = {
                            date: date,
                            total: 0
                        };
                    }
                    salesByDate[dateKey].total += parseFloat(item.total || 0);
                });

                // Get last 7 days with data
                const entries = Object.entries(salesByDate)
                    .sort((a, b) => b[1].date - a[1].date)
                    .slice(0, 7)
                    .reverse();

                // Simple day labels
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const chartLabels = entries.map(([_, data]) => {
                    const date = new Date(data.date);
                    date.setHours(0, 0, 0, 0);
                    const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) return 'Today';
                    if (diffDays === 1) return 'Yesterday';

                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return dayNames[date.getDay()];
                });

                const chartValues = entries.map(([_, data]) => data.total);

                const validChartValues = chartValues.length > 0 && chartValues.some(v => v > 0)
                    ? chartValues
                    : [0];
                const validChartLabels = chartLabels.length > 0
                    ? chartLabels
                    : ['No Sales'];

                setReportData({
                    totalSales: parseFloat(summary?.total_amount || 0).toFixed(2),
                    totalTransactions: parseInt(summary?.total_records || 0),
                    averageSale: summary?.total_records ? (summary.total_amount / summary.total_records).toFixed(2) : 0,
                    chartData: {
                        labels: validChartLabels,
                        datasets: [{ data: validChartValues }]
                    },
                    recentTransactions: groupedSales.slice(0, 5)
                });
            }
        } catch (error) {
            console.error("Dashboard fetch error:", error);
            // Handle unauthorized access - clear session and redirect to login
            if (error.response?.status === 401 || error.message?.includes('token')) {
                await authService.logout();
                navigation.replace('Login');
            }
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Initial load on mount - check for prefetched data
    useEffect(() => {
        if (prefetchedData) {
            fetchDashboardData(prefetchedData);
        } else {
            fetchDashboardData();
        }
    }, [prefetchedData, fetchDashboardData]);

    // Auto-refresh when screen comes into focus (skip the very first focus to avoid double-fetch)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            if (!hasInitiallyLoaded.current) {
                // Skip - initial load useEffect already handles this
                hasInitiallyLoaded.current = true;
                return;
            }
            fetchDashboardData();
        });

        return unsubscribe;
    }, [navigation, fetchDashboardData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchDashboardData();
    }, [fetchDashboardData]);

    const chartConfig = {
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        color: (opacity = 1) => `rgba(58, 72, 194, ${opacity})`, // Matching brand color
        strokeWidth: 3,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
        decimalPlaces: 0,
        propsForDots: {
            r: "5",
            strokeWidth: "2",
            stroke: "#3a48c2"
        },
        labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
        style: {
            borderRadius: 16
        },
        propsForBackgroundLines: {
            strokeDasharray: "5, 5",
            strokeWidth: 1,
            stroke: "rgba(0,0,0,0.1)"
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3a48c2" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#3a48c2" />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3a48c2" />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Header Background */}
                <LinearGradient
                    colors={['#3a48c2', '#2a38a0', '#192f6a']}
                    style={styles.headerBackground}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Decorative Elements */}
                    <View style={styles.decorativeCircle1} />
                    <View style={styles.decorativeCircle2} />

                    <SafeAreaView>
                        <View style={styles.headerContent}>
                            <View style={styles.headerTopRow}>
                                <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
                                    <MaterialCommunityIcons name="menu" size={22} color="#fff" />
                                </TouchableOpacity>
                                <View style={styles.dateBadge}>
                                    <MaterialCommunityIcons name="calendar-month" size={12} color="#E0E0E0" />
                                    <Text style={styles.dateText}>
                                        {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.welcomeContainer}>
                                <Text style={styles.greetingText}>Hello, {userName.split(' ')[0]}!</Text>
                                <Text style={styles.subGreetingText}>○  Lottery System</Text>
                            </View>
                        </View>
                    </SafeAreaView>
                </LinearGradient>

                <View style={styles.scrollContent}>
                    {/* Stats Cards - Overlapping the Header */}
                    <View style={[styles.statsContainer, { marginTop: -50 }]}>
                        <View style={styles.row}>
                            <DashboardCard
                                style={styles.totalSalesCard}
                                title="Total Sales"
                                value={`₹${reportData.totalSales}`}
                                icon="cash-multiple"
                                colors={['#3a48c2', '#2a38a0']} // Updated colors
                            />
                            <DashboardCard
                                style={styles.transactionCountCard}
                                title="Transactions"
                                value={reportData.totalTransactions.toString()}
                                icon="chart-timeline-variant"
                                colors={['#3a48c2', '#2a38a0']} // Updated colors
                            />
                        </View>
                    </View>

                    {/* Chart Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.titleContainer}>
                                <View style={styles.titleIndicator} />
                                <Text style={styles.sectionTitle}>Sales Trends</Text>
                            </View>

                        </View>

                        <View style={styles.chartCard}>
                            {reportData.chartData ? (
                                <LineChart
                                    data={reportData.chartData}
                                    width={screenWidth - 48} // Padding adjustments
                                    height={220}
                                    chartConfig={chartConfig}
                                    bezier
                                    style={styles.chart}
                                    withVerticalLines={false}
                                    withHorizontalLines={true}
                                    yAxisInterval={1}
                                />
                            ) : (
                                <View style={styles.noDataContainer}>
                                    <MaterialCommunityIcons name="chart-line-variant" size={40} color="#ddd" />
                                    <Text style={styles.noDataText}>No chart data available yet</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Recent Transactions Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.titleContainer}>
                                <View style={[styles.titleIndicator, { backgroundColor: '#10B981' }]} />
                                <Text style={styles.sectionTitle}>Recent Activity</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Reports')}
                                style={styles.seeAllButton}
                            >
                                <Text style={styles.seeAllText}>See All</Text>
                                <MaterialCommunityIcons name="chevron-right" size={16} color="#3a48c2" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.transactionsList}>
                            {reportData.recentTransactions.map((item, index) => (
                                <TransactionItem
                                    key={index}
                                    item={item}
                                    isLast={index === reportData.recentTransactions.length - 1}
                                />
                            ))}

                            {reportData.recentTransactions.length === 0 && (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons name="clipboard-text-outline" size={50} color="#E0E7FF" />
                                    <Text style={styles.emptyText}>No recent transactions</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FD',
    },
    headerBackground: {
        paddingBottom: 60, // Height for overlapping content
        borderBottomLeftRadius: 35,
        borderBottomRightRadius: 35,
        position: 'relative',
        overflow: 'hidden',
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
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
        paddingBottom: 20,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    welcomeContainer: {
        paddingLeft: 4,
    },
    greetingText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    subGreetingText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
    },
    dateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    dateText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
        marginLeft: 4,
    },
    menuButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        padding: 10,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    statsContainer: {
        marginBottom: 24,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    totalSalesCard: {
        width: '61%',
    },
    transactionCountCard: {
        width: '37%',
    },
    sectionContainer: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    titleIndicator: {
        width: 4,
        height: 18,
        backgroundColor: '#3a48c2',
        borderRadius: 2,
        marginRight: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1a',
        letterSpacing: 0.3,
    },
    periodBadge: {
        backgroundColor: '#EEF0FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    periodText: {
        fontSize: 11,
        color: '#3a48c2',
        fontWeight: '600',
    },
    chartCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        elevation: 4,
        shadowColor: '#3a48c2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        alignItems: 'center',
    },
    chart: {
        marginVertical: 4,
        borderRadius: 16,
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingLeft: 8,
    },
    seeAllText: {
        color: '#3a48c2',
        fontWeight: '700',
        fontSize: 13,
        marginRight: 2,
    },
    transactionsList: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F7FA',
    },
    lastTransactionCard: {
        marginBottom: 0,
        paddingBottom: 0,
        borderBottomWidth: 0,
    },
    transactionIconContainer: {
        marginRight: 16,
    },
    iconGradient: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    transactionInfo: {
        flex: 1,
    },
    transactionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    invoiceLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0e108ba6',
        paddingVertical: 1,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    transactionDate: {
        fontSize: 11,
        color: '#9E9E9E',
        fontWeight: '500',
    },
    amountContainer: {
        alignItems: 'flex-end',
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    transactionAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#15803d',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyText: {
        marginTop: 12,
        color: '#999',
        fontSize: 14,
        fontWeight: '500',
    },
    noDataContainer: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noDataText: {
        color: '#999',
        marginTop: 10,
        fontSize: 14,
    },
    groupDetails: {
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingLeft: 60, // Indent to align with text
    },
    subItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    subItemName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
    },
    subItemMeta: {
        fontSize: 11,
        color: '#888',
        marginTop: 1,
    },
    subItemTotal: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#15803d',
    },
});

export default DashboardScreen;
