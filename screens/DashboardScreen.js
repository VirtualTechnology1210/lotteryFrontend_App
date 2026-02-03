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
const TransactionItem = memo(({ item }) => (
    <View style={styles.transactionCard}>
        <View style={styles.transactionIconContainer}>
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={24} color="#3a48c2" />
        </View>
        <View style={styles.transactionInfo}>
            <Text style={styles.transactionTitle}>{item.product_name || `Order #${item.id}`}</Text>
            <Text style={styles.transactionDate}>
                {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
        </View>
        <Text style={styles.transactionAmount}>+₹{item.total}</Text>
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
        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        style: {
            borderRadius: 16
        },
        propsForBackgroundLines: {
            strokeDasharray: "", // solid lines
            strokeWidth: 1,
            stroke: "rgba(0,0,0,0.05)"
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
                <SafeAreaView>
                    <View style={styles.headerContent}>
                        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
                            <MaterialCommunityIcons name="menu" size={18} color="#fff" />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.greetingText}>Hello, {userName}</Text>
                            <Text style={styles.dateText}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </Text>
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
                            colors={['#1836beff', '#1a3c86ff']}
                        />
                        <DashboardCard
                            style={styles.transactionCountCard}
                            title="Transactions"
                            value={reportData.totalTransactions.toString()}
                            icon="chart-timeline-variant"
                            colors={['#1836beff', '#1a3c86ff']}
                        />
                    </View>
                </View>

                {/* Chart Section */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Sales Overview</Text>
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
                            <Text style={styles.noDataText}>No chart data available</Text>
                        )}
                    </View>
                </View>

                {/* Recent Transactions Section */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Transactions</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Reports')}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.transactionsList}>
                        {reportData.recentTransactions.map((item, index) => (
                            <TransactionItem key={index} item={item} />
                        ))}

                        {reportData.recentTransactions.length === 0 && (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="clipboard-text-outline" size={50} color="#ddd" />
                                <Text style={styles.emptyText}>No recent transactions</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Bottom Padding */}
                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    totalSalesCard: {
        width: '58%',
    },
    transactionCountCard: {
        width: '40%',
    },
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
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
        paddingBottom: 20,
    },
    greetingText: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    dateText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '500',
        textAlign: 'right',
    },
    menuButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 10,
        borderRadius: 102,
    },
    scrollView: {
        flex: 1,
        marginTop: -55, // Pull up to overlap header
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    statsContainer: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sectionContainer: {
        marginBottom: 25,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1a',
        letterSpacing: 0.5,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#EDEFF5',
    },
    filterText: {
        fontSize: 13,
        color: '#666',
        marginRight: 4,
        fontWeight: '500',
    },
    chartCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 15,
        elevation: 8,
        shadowColor: '#3a48c2',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        alignItems: 'center',
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    seeAllText: {
        color: '#3a48c2',
        fontWeight: '700',
        fontSize: 14,
    },
    transactionsList: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingBottom: 0, // Removed padding for cleaner list
    },
    transactionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#EEF0FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    transactionInfo: {
        flex: 1,
    },
    transactionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    transactionDate: {
        fontSize: 12,
        color: '#9E9E9E',
        fontWeight: '500',
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#00C853', // Material green accent
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        marginTop: 10,
        color: '#999',
        fontSize: 15,
    },
    noDataText: {
        color: '#999',
        marginVertical: 20,
    }
});

export default DashboardScreen;
