import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

const ReportsScreen = ({ navigation }) => {
    // Date/Time state
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());

    // Picker visibility
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

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

    const handleGenerateReport = async () => {
        const params = {
            start_date: formatDateForAPI(startDate),
            end_date: formatDateForAPI(endDate)
        };

        // Navigate to result screen with filters
        navigation.navigate('ReportResult', { filters: params });
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
                    <Text style={styles.headerTitle}>Sales Reports</Text>
                    <View style={styles.addButtonPlaceholder} />
                </View>
            </LinearGradient>

            <ScrollView style={styles.scrollView}>
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
                                }
                            }}
                        />
                    )}

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.generateBtn]}
                            onPress={handleGenerateReport}
                        >
                            <>
                                <MaterialCommunityIcons name="file-chart" size={20} color="#fff" />
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

export default ReportsScreen;
