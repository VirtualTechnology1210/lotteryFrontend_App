import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
    FlatList
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { categoryService } from '../services/categoryService';
import { winningService } from '../services/winningService';
import { authService } from '../services';

const WinningScreen = ({ navigation }) => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [lotteryNumber, setLotteryNumber] = useState('');

    // Results state
    const [results, setResults] = useState(null);
    const [showResults, setShowResults] = useState(false);

    // Permission state
    const [permissions, setPermissions] = useState({
        view: false,
        add: false
    });

    // Load permissions on mount
    useEffect(() => {
        const loadPermissions = async () => {
            try {
                const perms = await authService.getPermissions();
                const winningPerms = perms['winning'] || {};
                setPermissions({
                    view: winningPerms.view || false,
                    add: winningPerms.add || false
                });
            } catch (error) {
                console.error('Error loading permissions:', error);
            }
        };
        loadPermissions();
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await categoryService.getActiveCategories();
            if (response && response.data) {
                setCategories(response.data.categories || []);
            }
        } catch (error) {
            console.error('Fetch categories error:', error);
            Alert.alert('Error', 'Failed to load categories');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchCategories();

            return () => {
                // Reset state when leaving
                handleReset();
            };
        }, [fetchCategories, handleReset])
    );

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
        setShowDropdown(false);
        // Clear previous results when category changes
        setResults(null);
        setShowResults(false);
    };

    const getTimeSlotDisplay = () => {
        if (!selectedCategory || !selectedCategory.time_slots || selectedCategory.time_slots.length === 0) {
            return 'No time slot';
        }
        return selectedCategory.time_slots[0];
    };

    /**
     * Calculate the display-friendly time window on the frontend
     * so users can see the range BEFORE submitting
     */
    const getTimeWindowPreview = () => {
        if (!selectedCategory) return null;
        const timeSlot = selectedCategory.time_slots?.[0];
        if (!timeSlot) return null;

        // Parse time slot string like "3:00 PM" or "10:00 AM"
        const match12h = timeSlot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        const match24h = timeSlot.trim().match(/^(\d{1,2}):(\d{2})$/);

        let hours, minutes;
        if (match12h) {
            hours = parseInt(match12h[1], 10);
            minutes = parseInt(match12h[2], 10);
            const meridiem = match12h[3].toUpperCase();
            if (meridiem === 'AM') {
                if (hours === 12) hours = 0;
            } else {
                if (hours !== 12) hours += 12;
            }
        } else if (match24h) {
            hours = parseInt(match24h[1], 10);
            minutes = parseInt(match24h[2], 10);
        } else {
            return null;
        }

        const now = new Date();

        // End = today at [time_slot]
        const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

        // Start = yesterday at [time_slot]
        const windowStart = new Date(windowEnd);
        windowStart.setDate(windowStart.getDate() - 1);

        return {
            start: windowStart.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            }),
            end: windowEnd.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            })
        };
    };

    const handleSubmit = async () => {
        if (!selectedCategory) {
            Alert.alert('Validation Error', 'Please select a category');
            return;
        }

        if (!lotteryNumber.trim()) {
            Alert.alert('Validation Error', 'Please enter lottery number');
            return;
        }

        setIsSubmitting(true);
        setResults(null);
        setShowResults(false);

        try {
            const payload = {
                category_id: selectedCategory.id,
                lottery_number: lotteryNumber.trim()
            };

            const response = await winningService.checkWinning(payload);

            if (response && response.data) {
                setResults(response.data);
                setShowResults(true);
            }
        } catch (error) {
            console.error('Check winning error:', error);
            Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to check winning number');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = useCallback(() => {
        setSelectedCategory(null);
        setLotteryNumber('');
        setResults(null);
        setShowResults(false);
    }, []);

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    /**
     * Get the matching suffix info for display.
     * For a winning number like 8321:
     *   Round 4 (Exact): full number "8321"
     *   Round 3 (Last 3): suffix "321"
     *   Round 2 (Last 2): suffix "21"
     *   Round 1 (Last 1): suffix "1"
     */
    const getMatchInfo = (matchRound) => {
        if (!results) return { label: '', suffix: '', color: '#666' };
        const num = results.lottery_number;
        switch (matchRound) {
            case 4: return { label: 'Exact Match', suffix: num, color: '#92400E' };
            case 3: return { label: 'Last 3 Digits', suffix: num.slice(-3), color: '#065F46' };
            case 2: return { label: 'Last 2 Digits', suffix: num.slice(-2), color: '#374151' };
            case 1: return { label: 'Last Digit', suffix: num.slice(-1), color: '#991B1B' };
            default: return { label: '', suffix: '', color: '#666' };
        }
    };

    const renderSaleItem = ({ item, index }) => {
        const matchInfo = getMatchInfo(item.match_round);
        const lotteryNum = item.lottery_number || '';
        const suffix = matchInfo.suffix;

        // Split the lottery number into non-matching prefix + matching suffix
        const prefixLength = lotteryNum.length - suffix.length;
        const prefix = lotteryNum.slice(0, prefixLength);
        const matchedPart = lotteryNum.slice(prefixLength);

        return (
            <View style={styles.saleItem}>
                <View style={styles.saleItemHeader}>
                    <View style={styles.saleIndexBadge}>
                        <Text style={styles.saleIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.saleInvoice}>
                        Invoice Number : {item.invoice_number}
                    </Text>
                    {item.box === 1 && (
                        <View style={styles.boxBadge}>
                            <Text style={styles.boxBadgeText}>BOX</Text>
                        </View>
                    )}
                </View>
                <View style={styles.saleItemBody}>
                    <View style={styles.saleDetailRow}>
                        <MaterialCommunityIcons name="package-variant" size={16} color="#666" />
                        <Text style={styles.saleDetailLabel}>Product:</Text>
                        <Text style={styles.saleDetailValue}>{item.product_name || '-'}</Text>
                    </View>
                    <View style={styles.saleDetailRow}>
                        <MaterialCommunityIcons name="ticket-outline" size={16} color="#666" />
                        <Text style={styles.saleDetailLabel}>Number:</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 15, color: '#888', fontWeight: '500' }}>{prefix}</Text>
                            <Text style={{ fontSize: 15, color: matchInfo.color, fontWeight: '800' }}>{matchedPart}</Text>
                        </View>
                    </View>
                    <View style={styles.saleDetailRow}>
                        <MaterialCommunityIcons name="counter" size={16} color="#666" />
                        <Text style={styles.saleDetailLabel}>Qty:</Text>
                        <Text style={styles.saleDetailValue}>{item.qty}</Text>
                    </View>
                    <View style={styles.saleDetailRow}>
                        <MaterialCommunityIcons name="calendar-clock" size={16} color="#666" />
                        <Text style={styles.saleDetailLabel}>Date & Time:</Text>
                        <Text style={styles.saleDetailValue}>{formatDateTime(item.sold_at || item.createdAt || item.created_at)}</Text>
                    </View>
                    <View style={styles.saleDetailRow}>
                        <MaterialCommunityIcons name="account-outline" size={16} color="#666" />
                        <Text style={styles.saleDetailLabel}>Created By:</Text>
                        <Text style={styles.saleDetailValue}>{item.sold_by || '-'}</Text>
                    </View>
                </View>
            </View>
        );
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
                    <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
                        <MaterialCommunityIcons name="menu" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Winning Entry</Text>
                    <View style={styles.addButtonPlaceholder} />
                </View>
            </LinearGradient>

            <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
                {!permissions.view ? (
                    <View style={styles.noPermissionContainer}>
                        <MaterialCommunityIcons name="lock-outline" size={80} color="#ddd" />
                        <Text style={styles.noPermissionTitle}>No Permission</Text>
                        <Text style={styles.noPermissionText}>
                            You don't have permission to access Winning Entry.{'\n'}
                            Please contact your administrator.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Form Container */}
                        <View style={styles.formContainer}>
                            {/* Category Dropdown */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Category *</Text>
                                <TouchableOpacity
                                    style={styles.dropdownButton}
                                    onPress={() => setShowDropdown(!showDropdown)}
                                >
                                    <Text style={selectedCategory ? styles.dropdownTextSelected : styles.dropdownText}>
                                        {selectedCategory ? selectedCategory.category_name : 'Select a category'}
                                    </Text>
                                    <MaterialCommunityIcons
                                        name={showDropdown ? "chevron-up" : "chevron-down"}
                                        size={24}
                                        color="#666"
                                    />
                                </TouchableOpacity>

                                {showDropdown && (
                                    <View style={styles.dropdownList}>
                                        {categories.length === 0 ? (
                                            <Text style={styles.dropdownEmptyText}>No categories available</Text>
                                        ) : (
                                            categories.map((category) => (
                                                <TouchableOpacity
                                                    key={category.id}
                                                    style={[
                                                        styles.dropdownItem,
                                                        selectedCategory?.id === category.id && styles.dropdownItemSelected
                                                    ]}
                                                    onPress={() => handleCategorySelect(category)}
                                                >
                                                    <Text style={[
                                                        styles.dropdownItemText,
                                                        selectedCategory?.id === category.id && styles.dropdownItemTextSelected
                                                    ]}>
                                                        {category.category_name}
                                                    </Text>
                                                    {selectedCategory?.id === category.id && (
                                                        <MaterialCommunityIcons name="check" size={20} color="#3a48c2" />
                                                    )}
                                                </TouchableOpacity>
                                            ))
                                        )}
                                    </View>
                                )}
                            </View>

                            {/* Selected Category Info */}
                            {selectedCategory && (
                                <View style={styles.selectedInfoContainer}>
                                    <View style={styles.selectedInfoRow}>
                                        <MaterialCommunityIcons name="shape" size={18} color="#3a48c2" />
                                        <Text style={styles.selectedInfoLabel}>Category:</Text>
                                        <Text style={styles.selectedInfoValue}>{selectedCategory.category_name}</Text>
                                    </View>
                                    <View style={styles.selectedInfoRow}>
                                        <MaterialCommunityIcons name="clock-outline" size={18} color="#3a48c2" />
                                        <Text style={styles.selectedInfoLabel}>Time Slot:</Text>
                                        <Text style={styles.selectedInfoValue}>{getTimeSlotDisplay()}</Text>
                                    </View>
                                    {getTimeWindowPreview() && (
                                        <>
                                            <View style={styles.selectedInfoDivider} />
                                            <View style={styles.selectedInfoRow}>
                                                <MaterialCommunityIcons name="calendar-arrow-right" size={18} color="#17996eff" />
                                                <Text style={styles.selectedInfoLabel}>From:</Text>
                                                <Text style={[styles.selectedInfoValue, { color: '#17996eff' }]}>{getTimeWindowPreview().start}</Text>
                                            </View>
                                            <View style={styles.selectedInfoRow}>
                                                <MaterialCommunityIcons name="calendar-arrow-left" size={18} color="#181a8fff" />
                                                <Text style={styles.selectedInfoLabel}>To:</Text>
                                                <Text style={[styles.selectedInfoValue, { color: '#181a8fff' }]}>{getTimeWindowPreview().end}</Text>
                                            </View>
                                        </>
                                    )}
                                </View>
                            )}

                            {/* Lottery Number Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Lottery Number *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter lottery number"
                                    value={lotteryNumber}
                                    onChangeText={(text) => {
                                        setLotteryNumber(text);
                                        // Clear results when number changes
                                        if (showResults) {
                                            setResults(null);
                                            setShowResults(false);
                                        }
                                    }}
                                    placeholderTextColor="#999"
                                    keyboardType="default"
                                />
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                                    onPress={handleSubmit}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
                                            <Text style={styles.submitButtonText}>Check</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                            </View>
                        </View>

                        {/* Results Section */}
                        {showResults && results && (
                            <View style={styles.resultsContainer}>

                                {/* No Match Banner */}
                                {!results.is_winner && (
                                    <LinearGradient
                                        colors={['#ef444488', '#dc262688']}
                                        style={styles.resultBanner}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <MaterialCommunityIcons name="close-circle" size={40} color="#fff" />
                                        <Text style={styles.resultBannerTitle}>No Match Found</Text>
                                        <Text style={styles.resultBannerSubtitle}>
                                            No sales match this lottery number in the current window
                                        </Text>
                                    </LinearGradient>
                                )}

                                {/* Winner Summary */}
                                {results.is_winner && results.summary && (
                                    <View style={styles.summaryCard}>
                                        <View style={styles.summaryHeader}>
                                            <Text style={styles.summaryTitle}>Match Summary</Text>
                                            <Text style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>Number: {results.lottery_number}</Text>
                                        </View>
                                        <View style={styles.summaryDivider} />
                                        {results.summary.round_4_count > 0 && (
                                            <View style={styles.summaryRow}>
                                                <View style={[styles.summaryDot, { backgroundColor: '#92400E' }]} />
                                                <Text style={styles.summaryLabel}>Exact Match ({results.lottery_number})</Text>
                                                <Text style={[styles.summaryCount, { color: '#92400E' }]}>{results.summary.round_4_count}</Text>
                                            </View>
                                        )}
                                        {results.summary.round_3_count > 0 && (
                                            <View style={styles.summaryRow}>
                                                <View style={[styles.summaryDot, { backgroundColor: '#065F46' }]} />
                                                <Text style={styles.summaryLabel}>Last 3 Digits ({results.lottery_number.slice(-3)})</Text>
                                                <Text style={[styles.summaryCount, { color: '#065F46' }]}>{results.summary.round_3_count}</Text>
                                            </View>
                                        )}
                                        {results.summary.round_2_count > 0 && (
                                            <View style={styles.summaryRow}>
                                                <View style={[styles.summaryDot, { backgroundColor: '#374151' }]} />
                                                <Text style={styles.summaryLabel}>Last 2 Digits ({results.lottery_number.slice(-2)})</Text>
                                                <Text style={[styles.summaryCount, { color: '#374151' }]}>{results.summary.round_2_count}</Text>
                                            </View>
                                        )}
                                        {results.summary.round_1_count > 0 && (
                                            <View style={styles.summaryRow}>
                                                <View style={[styles.summaryDot, { backgroundColor: '#991B1B' }]} />
                                                <Text style={styles.summaryLabel}>Last Digit ({results.lottery_number.slice(-1)})</Text>
                                                <Text style={[styles.summaryCount, { color: '#991B1B' }]}>{results.summary.round_1_count}</Text>
                                            </View>
                                        )}
                                        <View style={styles.summaryDivider} />
                                        <View style={styles.summaryRow}>
                                            <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Total Matches:</Text>
                                            <Text style={[styles.summaryCount, { fontWeight: '800', color: '#3a48c2' }]}>{results.summary.total_winners}</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Round 4 - Exact Match */}
                                {results.results?.round_4?.length > 0 && (
                                    <View style={styles.salesListContainer}>
                                        <View style={[styles.roundHeader, { backgroundColor: '#FEF3C7' }]}>
                                            <View>
                                                <Text style={[styles.roundHeaderTitle, { color: '#92400E' }]}>EXACT MATCH ({results.lottery_number}) - {results.results.round_4.length}</Text>
                                            </View>
                                        </View>
                                        {results.results.round_4.map((item, index) => (
                                            <View key={`r4-${item.id}-${item.lottery_number}-${index}`}>
                                                {renderSaleItem({ item, index })}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Round 3 - Last 3 Digits Match */}
                                {results.results?.round_3?.length > 0 && (
                                    <View style={styles.salesListContainer}>
                                        <View style={[styles.roundHeader, { backgroundColor: '#ECFDF5' }]}>
                                            <View>
                                                <Text style={[styles.roundHeaderTitle, { color: '#065F46' }]}>LAST 3 DIGITS ({results.lottery_number.slice(-3)}) - {results.results.round_3.length}</Text>
                                            </View>
                                        </View>
                                        {results.results.round_3.map((item, index) => (
                                            <View key={`r3-${item.id}-${item.lottery_number}-${index}`}>
                                                {renderSaleItem({ item, index })}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Round 2 - Last 2 Digits Match */}
                                {results.results?.round_2?.length > 0 && (
                                    <View style={styles.salesListContainer}>
                                        <View style={[styles.roundHeader, { backgroundColor: '#F3F4F6' }]}>
                                            <View>
                                                <Text style={[styles.roundHeaderTitle, { color: '#374151' }]}>LAST 2 DIGITS ({results.lottery_number.slice(-2)}) - {results.results.round_2.length}</Text>
                                            </View>
                                        </View>
                                        {results.results.round_2.map((item, index) => (
                                            <View key={`r2-${item.id}-${item.lottery_number}-${index}`}>
                                                {renderSaleItem({ item, index })}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Round 1 - Last 1 Digit Match */}
                                {results.results?.round_1?.length > 0 && (
                                    <View style={styles.salesListContainer}>
                                        <View style={[styles.roundHeader, { backgroundColor: '#FEF2F2' }]}>
                                            <View>
                                                <Text style={[styles.roundHeaderTitle, { color: '#991B1B' }]}>LAST DIGIT ({results.lottery_number.slice(-1)}) - {results.results.round_1.length}</Text>
                                            </View>
                                        </View>
                                        {results.results.round_1.map((item, index) => (
                                            <View key={`r1-${item.id}-${item.lottery_number}-${index}`}>
                                                {renderSaleItem({ item, index })}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    noPermissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100,
        paddingHorizontal: 40,
    },
    noPermissionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#666',
        marginTop: 20,
        marginBottom: 10,
    },
    noPermissionText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        lineHeight: 24,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    menuButton: {
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
    addButtonPlaceholder: {
        width: 44,
        height: 44,
    },
    scrollView: {
        flex: 1,
    },
    formContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 10,
        padding: 20,
        borderRadius: 24,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    inputGroup: {
        marginBottom: 15,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    dropdownText: {
        fontSize: 15,
        color: '#999',
    },
    dropdownTextSelected: {
        fontSize: 15,
        color: '#1a1a1a',
    },
    dropdownList: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        maxHeight: 200,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    dropdownItemSelected: {
        backgroundColor: '#EEF0FF',
    },
    dropdownItemText: {
        fontSize: 15,
        color: '#333',
    },
    dropdownItemTextSelected: {
        color: '#3a48c2',
        fontWeight: '600',
    },
    dropdownEmptyText: {
        fontSize: 14,
        color: '#999',
        padding: 20,
        textAlign: 'center',
    },
    selectedInfoContainer: {
        backgroundColor: '#F0F2FF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#D8DBFF',
    },
    selectedInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    selectedInfoLabel: {
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
        marginRight: 6,
    },
    selectedInfoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        flex: 1,
    },
    selectedInfoDivider: {
        height: 1,
        backgroundColor: '#D8DBFF',
        marginVertical: 8,
    },
    // ── Time Window Info Card ─────────────────────────────────────
    timeWindowCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#E8E9F0',
    },
    timeWindowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    timeWindowTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    timeWindowDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 10,
    },
    timeWindowRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 6,
    },
    timeWindowLabel: {
        fontSize: 13,
        color: '#888',
        width: 95,
    },
    timeWindowValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    input: {
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 5,
    },
    submitButton: {
        flex: 1,
        backgroundColor: '#3a48c2',
        borderRadius: 22,
        padding: 13,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    resetButton: {
        backgroundColor: '#EEF0FF',
        borderRadius: 22,
        paddingHorizontal: 20,
        paddingVertical: 13,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#D8DBFF',
    },
    resetButtonText: {
        color: '#3a48c2',
        fontSize: 15,
        fontWeight: '600',
    },

    // ── Results Section ──────────────────────────────────────────
    resultsContainer: {
        marginHorizontal: 20,
        marginBottom: 30,
    },
    resultBanner: {
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 12,
    },
    resultBannerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 8,
        letterSpacing: 1,
    },
    resultBannerSubtitle: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
    searchInfoCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    searchInfoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    searchInfoRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    searchInfoLabel: {
        fontSize: 13,
        color: '#888',
        width: 80,
    },
    searchInfoValue: {
        fontSize: 13,
        color: '#333',
        fontWeight: '500',
        flex: 1,
    },
    // ── Summary Card ────────────────────────────────────────────
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    summaryTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
    },
    summaryDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    summaryRoundIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    summaryLabel: {
        fontSize: 13,
        color: '#4B5563',
        flex: 1,
    },
    summaryCount: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        minWidth: 30,
        textAlign: 'right',
    },
    // ── Round Headers ───────────────────────────────────────────
    roundHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        gap: 10,
    },
    roundHeaderIcon: {
        fontSize: 24,
    },
    roundHeaderTitle: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    roundHeaderSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    salesListContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    salesListTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    saleItem: {
        backgroundColor: '#F8F9FD',
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E8E9F0',
    },
    saleItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF0FF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#D8DBFF',
    },
    saleIndexBadge: {
        backgroundColor: '#3a48c2',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    saleIndexText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    saleInvoice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3a48c2',
        flex: 1,
    },
    boxBadge: {
        backgroundColor: '#F59E0B',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginLeft: 8,
    },
    boxBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    saleItemBody: {
        padding: 12,
    },
    saleDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    saleDetailLabel: {
        fontSize: 13,
        color: '#888',
        marginLeft: 6,
        width: 65,
    },
    saleDetailValue: {
        fontSize: 13,
        color: '#333',
        fontWeight: '500',
        flex: 1,
    },
    saleTotalValue: {
        color: '#10b981',
        fontWeight: '700',
    },
});

export default WinningScreen;
