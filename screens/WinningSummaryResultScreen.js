import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { winningService } from '../services/winningService';

const WinningSummaryResultScreen = ({ navigation, route }) => {
    // Get filter params from navigation (same pattern as ReportResultScreen)
    const filters = route.params?.filters || {};
    const startDate = filters.start_date || new Date().toISOString().split('T')[0];
    const endDate = filters.end_date || startDate;

    // Data state
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState(null);

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
            const response = await winningService.getWinningSummary(startDate, endDate);

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
    }, [startDate, endDate]);

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
                    <View style={styles.headerPlaceholder} />
                </View>

                {/* Date Range Badge */}
                <View style={styles.dateRangeBadge}>
                    <MaterialCommunityIcons name="calendar-range" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.dateRangeText}>{dateRangeLabel}</Text>
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

                        {/* ── Grand Summary: Sales | Winning | Balance ── */}
                        <View style={styles.summaryGrid}>
                            <View style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <MaterialCommunityIcons name="cash-register" size={24} color="#3a48c2" />
                                    <Text style={styles.summaryValue}>
                                        ₹{(summary.total_sales_amount || 0).toLocaleString('en-IN')}
                                    </Text>
                                </View>
                                <Text style={styles.summaryLabel}>Total Sales Prize</Text>
                            </View>

                            <View style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <MaterialCommunityIcons name="trophy-outline" size={24} color="#dc2626" />
                                    <Text style={styles.summaryValue}>
                                        ₹{(summary.total_winning_amount || 0).toLocaleString('en-IN')}
                                    </Text>
                                </View>
                                <Text style={styles.summaryLabel}>Winning Amount</Text>
                            </View>

                            <View style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <Text style={[styles.summaryValue, { color: summary.total_balance >= 0 ? '#059669' : '#dc2626' }]}>
                                        ₹{(summary.total_balance || 0).toLocaleString('en-IN')}
                                    </Text>
                                </View>
                                <Text style={styles.summaryLabel}>Balance</Text>
                            </View>
                        </View>

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
    summaryGrid: {
        flexDirection: 'column',
        gap: 12,
    },
    summaryCard: {
        width: '100%',
        backgroundColor: '#fff',
        padding: 30,
        borderRadius: 12,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
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
});

export default WinningSummaryResultScreen;
