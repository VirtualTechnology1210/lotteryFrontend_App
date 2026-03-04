import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { categoryService } from '../services/categoryService';

const WinningSummaryScreen = ({ navigation }) => {
    // Date state — default to today
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());

    // Picker visibility
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    // Category state
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null); // null = All Categories
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);

    // Fetch categories on mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await categoryService.getActiveCategories();
                if (response && response.data) {
                    setCategories(response.data.categories || []);
                }
            } catch (err) {
                console.error('Failed to fetch categories:', err);
            } finally {
                setIsCategoriesLoading(false);
            }
        };
        fetchCategories();
    }, []);

    const formatDate = (date) => {
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatDateForAPI = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
        setShowCategoryDropdown(false);
    };

    const handleSubmit = () => {
        const params = {
            start_date: formatDateForAPI(startDate),
            end_date: formatDateForAPI(endDate),
        };

        // Add category filter if a specific category is selected
        if (selectedCategory) {
            params.category_id = selectedCategory.id;
            params.category_name = selectedCategory.category_name;
        }

        // Navigate to result screen with filters
        navigation.navigate('WinningSummaryResult', { filters: params });
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
                {/* Decorative Elements */}
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />

                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
                        <MaterialCommunityIcons name="menu" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Winning Summary</Text>
                    <View style={styles.addButtonPlaceholder} />
                </View>
            </LinearGradient>

            <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
                {/* Filter Section */}
                <View style={styles.filterContainer}>
                    <Text style={styles.sectionTitle}>Filter by Date</Text>

                    {/* Date Pickers */}
                    <View style={styles.dateRow}>
                        <View style={styles.dateInputGroup}>
                            <Text style={styles.label}>Start Date</Text>
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => setShowStartDatePicker(true)}
                            >
                                <MaterialCommunityIcons name="calendar" size={20} color="#3a48c2" />
                                <Text style={styles.pickerButtonText}>{formatDate(startDate)}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.dateInputGroup}>
                            <Text style={styles.label}>End Date</Text>
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => setShowEndDatePicker(true)}
                            >
                                <MaterialCommunityIcons name="calendar" size={20} color="#3a48c2" />
                                <Text style={styles.pickerButtonText}>{formatDate(endDate)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Date Pickers Components */}
                    {showStartDatePicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowStartDatePicker(false);
                                if (selectedDate) {
                                    setStartDate(selectedDate);
                                    // If start > end, adjust end
                                    if (selectedDate > endDate) {
                                        setEndDate(selectedDate);
                                    }
                                }
                            }}
                        />
                    )}

                    {showEndDatePicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowEndDatePicker(false);
                                if (selectedDate) {
                                    setEndDate(selectedDate);
                                    // If end < start, adjust start
                                    if (selectedDate < startDate) {
                                        setStartDate(selectedDate);
                                    }
                                }
                            }}
                        />
                    )}

                    {/* Category Dropdown */}
                    <View style={styles.categorySection}>
                        <Text style={styles.label}>Category</Text>
                        {isCategoriesLoading ? (
                            <View style={styles.categoryLoadingContainer}>
                                <ActivityIndicator size="small" color="#3a48c2" />
                                <Text style={styles.categoryLoadingText}>Loading categories...</Text>
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={styles.dropdownButton}
                                    onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                >
                                    <View style={styles.dropdownButtonContent}>
                                        <MaterialCommunityIcons
                                            name={selectedCategory ? "shape" : "shape-outline"}
                                            size={20}
                                            color={selectedCategory ? "#3a48c2" : "#999"}
                                        />
                                        <Text style={selectedCategory ? styles.dropdownTextSelected : styles.dropdownText}>
                                            {selectedCategory ? selectedCategory.category_name : 'All Categories'}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons
                                        name={showCategoryDropdown ? "chevron-up" : "chevron-down"}
                                        size={22}
                                        color="#666"
                                    />
                                </TouchableOpacity>

                                {showCategoryDropdown && (
                                    <View style={styles.dropdownList}>
                                        {/* All Categories Option */}
                                        <TouchableOpacity
                                            style={[
                                                styles.dropdownItem,
                                                !selectedCategory && styles.dropdownItemSelected
                                            ]}
                                            onPress={() => handleCategorySelect(null)}
                                        >
                                            <View style={styles.dropdownItemContent}>
                                                <MaterialCommunityIcons
                                                    name="view-grid-outline"
                                                    size={18}
                                                    color={!selectedCategory ? "#3a48c2" : "#666"}
                                                />
                                                <Text style={[
                                                    styles.dropdownItemText,
                                                    !selectedCategory && styles.dropdownItemTextSelected
                                                ]}>
                                                    All Categories
                                                </Text>
                                            </View>
                                            {!selectedCategory && (
                                                <MaterialCommunityIcons name="check" size={20} color="#3a48c2" />
                                            )}
                                        </TouchableOpacity>

                                        {/* Divider */}
                                        <View style={styles.dropdownDivider} />

                                        {/* Category Options */}
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
                                                    <View style={styles.dropdownItemContent}>
                                                        <MaterialCommunityIcons
                                                            name="shape"
                                                            size={18}
                                                            color={selectedCategory?.id === category.id ? "#3a48c2" : "#666"}
                                                        />
                                                        <Text style={[
                                                            styles.dropdownItemText,
                                                            selectedCategory?.id === category.id && styles.dropdownItemTextSelected
                                                        ]}>
                                                            {category.category_name}
                                                        </Text>
                                                    </View>
                                                    {selectedCategory?.id === category.id && (
                                                        <MaterialCommunityIcons name="check" size={20} color="#3a48c2" />
                                                    )}
                                                </TouchableOpacity>
                                            ))
                                        )}
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.generateBtn]}
                            onPress={handleSubmit}
                        >
                            <>
                                <MaterialCommunityIcons name="trophy-outline" size={20} color="#fff" />
                                <Text style={styles.generateBtnText}>
                                    Submit
                                </Text>
                            </>
                        </TouchableOpacity>
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
    filterContainer: {
        backgroundColor: '#fff',
        margin: 20,
        padding: 20,
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 15,
    },
    dateRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 15,
    },
    dateInputGroup: {
        flex: 1,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        gap: 8,
    },
    pickerButtonText: {
        fontSize: 14,
        color: '#1a1a1a',
        flex: 1,
    },
    // ── Category Dropdown ─────────────────────────────────────────
    categorySection: {
        marginBottom: 15,
    },
    categoryLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        gap: 10,
    },
    categoryLoadingText: {
        fontSize: 14,
        color: '#999',
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F7FA',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    dropdownButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    dropdownText: {
        fontSize: 14,
        color: '#999',
    },
    dropdownTextSelected: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '600',
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
        shadowRadius: 6,
        maxHeight: 250,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    dropdownItemSelected: {
        backgroundColor: '#EEF0FF',
    },
    dropdownItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#333',
    },
    dropdownItemTextSelected: {
        color: '#3a48c2',
        fontWeight: '700',
    },
    dropdownDivider: {
        height: 1,
        backgroundColor: '#F0F0F5',
        marginHorizontal: 14,
    },
    dropdownEmptyText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        paddingVertical: 16,
    },
    // ── Action Buttons ────────────────────────────────────────────
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    generateBtn: {
        backgroundColor: '#3a48c2',
    },
    generateBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default WinningSummaryScreen;
