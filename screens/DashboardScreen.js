import React, { useState, useEffect, useCallback, memo } from 'react';
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
const TransactionItem = memo(({ item, isLast }) => (
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
            <View style={styles.dateContainer}>
                <MaterialCommunityIcons name="clock-outline" size={10} color="#888" style={{ marginRight: 3 }} />
                <Text style={styles.transactionDate}>
                    {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
        <View style={styles.amountContainer}>
            <Text style={styles.transactionAmount}>+₹{item.total}</Text>
        </View>
    </View>
));

const DashboardScreen = ({ navigation }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userName, setUserName] = useState('');
    const [reportData, setReportData] = useState({
        totalSales: 0,
        totalTransactions: 0,
        averageSale: 0,
        chartData: null,
        recentTransactions: []
    });

    const fetchDashboardData = useCallback(async () => {
        try {
            const { user } = await authService.getAuthData();
            if (user) {
                setUserName(user.name);
            }

            const response = await reportService.getSalesReport({ limit: 10 });

            if (response && response.data) {
                const { summary, report } = response.data;
                const sales = report || [];

                // Process chart data (last 7 items)
                const chartLabels = sales.slice(0, 7).map(item => {
                    const d = new Date(item.created_at);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                }).reverse();

                // Use 'total' field (not 'price') and ensure valid numbers
                const chartValues = sales.slice(0, 7).map(item => {
                    const value = parseFloat(item.total || item.price || 0);
                    return isNaN(value) ? 0 : value;
                }).reverse();

                // Ensure we have at least one valid data point
                const validChartValues = chartValues.length > 0 && chartValues.some(v => v > 0)
                    ? chartValues
                    : [0];
                const validChartLabels = chartLabels.length > 0
                    ? chartLabels
                    : ['No Data'];

                setReportData({
                    totalSales: parseFloat(summary?.total_amount || 0).toFixed(2),
                    totalTransactions: parseInt(summary?.total_records || 0),
                    averageSale: summary?.total_records ? (summary.total_amount / summary.total_records).toFixed(2) : 0,
                    chartData: {
                        labels: validChartLabels,
                        datasets: [{ data: validChartValues }]
                    },
                    recentTransactions: sales.slice(0, 5)
                });
            }
        } catch (error) {
            console.error("Dashboard fetch error:", error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

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
                                    {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
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

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3a48c2" />
                }
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
            >
                {/* Stats Cards - Overlapping the Header */}
                <View style={styles.statsContainer}>
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

                {/* Bottom Padding */}
                <View style={{ height: 40 }} />
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
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 10,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    scrollView: {
        flex: 1,
        marginTop: -60, // Pull up to overlap header
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
    }
});

export default DashboardScreen;
