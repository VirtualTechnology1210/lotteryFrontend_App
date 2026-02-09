import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ToastAndroid,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import PrinterService from '../printer/PrinterService';

const PrinterSettingsScreen = ({ navigation }) => {
    const [scanning, setScanning] = useState(false);
    const [printers, setPrinters] = useState([]);
    const [savedPrinter, setSavedPrinter] = useState(null);
    const [connecting, setConnecting] = useState(false);
    const [selectedPrinterId, setSelectedPrinterId] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Load saved printer on mount
    useEffect(() => {
        loadSavedPrinter();
    }, []);

    const loadSavedPrinter = async () => {
        try {
            const printer = await PrinterService.getSavedPrinter();
            setSavedPrinter(printer);
        } catch (error) {
            console.error('Error loading saved printer:', error);
        }
    };

    const handleScan = async () => {
        setScanning(true);
        setPrinters([]);

        try {
            await PrinterService.scanAllPrinters((device) => {
                setPrinters(prev => {
                    // Avoid duplicates
                    if (prev.find(p => p.id === device.id)) {
                        return prev;
                    }
                    return [...prev, device];
                });
            }, 10000);

            // Wait for scan to complete
            setTimeout(() => {
                setScanning(false);
            }, 10500);
        } catch (error) {
            setScanning(false);
            const msg = error.message || 'Failed to scan for printers';
            if (Platform.OS === 'android') {
                ToastAndroid.show(`Scan: ${msg}`, ToastAndroid.SHORT);
            } else {
                console.warn('Scan Error:', msg);
            }
        }
    };

    const handleConnectAndSave = async (printer) => {
        setConnecting(true);
        setSelectedPrinterId(printer.id);

        try {
            // Test connection
            const connection = await PrinterService.connectToPrinter(printer);

            // Disconnect after successful test
            await PrinterService.disconnectPrinter(connection);

            // Save printer
            await PrinterService.savePrinter(printer);
            setSavedPrinter(printer);

            Alert.alert('Success', `Printer "${printer.name}" connected and saved successfully!`);
        } catch (error) {
            const msg = error.message || 'Failed to connect to printer';
            if (Platform.OS === 'android') {
                ToastAndroid.show(`Connection: ${msg}`, ToastAndroid.SHORT);
            } else {
                console.warn('Connection Error:', msg);
            }
        } finally {
            setConnecting(false);
            setSelectedPrinterId(null);
        }
    };

    const handleRemoveSavedPrinter = async () => {
        Alert.alert(
            'Remove Printer',
            'Are you sure you want to remove the saved printer?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        await PrinterService.removeSavedPrinter();
                        setSavedPrinter(null);
                    }
                }
            ]
        );
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadSavedPrinter().finally(() => setRefreshing(false));
    };

    const renderPrinterItem = (printer) => {
        const isConnecting = connecting && selectedPrinterId === printer.id;
        const isSaved = savedPrinter?.id === printer.id;

        return (
            <TouchableOpacity
                key={printer.id}
                style={[styles.printerItem, isSaved && styles.printerItemSaved]}
                onPress={() => handleConnectAndSave(printer)}
                disabled={connecting}
            >
                <View style={styles.printerIcon}>
                    <MaterialCommunityIcons
                        name={printer.type === 'BLE' ? 'bluetooth' : 'bluetooth-connect'}
                        size={24}
                        color={isSaved ? '#059669' : '#3a48c2'}
                    />
                </View>
                <View style={styles.printerInfo}>
                    <Text style={styles.printerName}>{printer.name}</Text>
                    <Text style={styles.printerType}>
                        {printer.type} • {printer.id}
                    </Text>
                </View>
                <View style={styles.printerAction}>
                    {isConnecting ? (
                        <ActivityIndicator size="small" color="#3a48c2" />
                    ) : isSaved ? (
                        <MaterialCommunityIcons name="check-circle" size={24} color="#059669" />
                    ) : (
                        <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
                    )}
                </View>
            </TouchableOpacity>
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
                    <Text style={styles.headerTitle}>Printer Settings</Text>
                    <View style={styles.placeholder} />
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3a48c2" />
                }
            >
                {/* Saved Printer Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Saved Printer</Text>
                    {savedPrinter ? (
                        <View style={styles.savedPrinterCard}>
                            <View style={styles.savedPrinterInfo}>
                                <MaterialCommunityIcons name="printer-check" size={40} color="#059669" />
                                <View style={styles.savedPrinterDetails}>
                                    <Text style={styles.savedPrinterName}>{savedPrinter.name}</Text>
                                    <Text style={styles.savedPrinterType}>
                                        {savedPrinter.type} • {savedPrinter.id}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.savedPrinterActions}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.removeButton]}
                                    onPress={handleRemoveSavedPrinter}
                                >
                                    <MaterialCommunityIcons name="delete" size={18} color="#fff" />
                                    <Text style={styles.actionButtonText}>Remove Printer</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noPrinterCard}>
                            <MaterialCommunityIcons name="printer-off" size={50} color="#ccc" />
                            <Text style={styles.noPrinterText}>No printer saved</Text>
                            <Text style={styles.noPrinterSubtext}>
                                Scan for printers and select one to save
                            </Text>
                        </View>
                    )}
                </View>

                {/* Scan Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Available Printers</Text>
                        <TouchableOpacity
                            style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
                            onPress={handleScan}
                            disabled={scanning}
                        >
                            {scanning ? (
                                <>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={styles.scanButtonText}>Scanning...</Text>
                                </>
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="bluetooth-audio" size={18} color="#fff" />
                                    <Text style={styles.scanButtonText}>Scan</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {printers.length > 0 ? (
                        <View style={styles.printerList}>
                            {printers.map(renderPrinterItem)}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons
                                name={scanning ? 'bluetooth-audio' : 'bluetooth-off'}
                                size={50}
                                color="#ccc"
                            />
                            <Text style={styles.emptyStateText}>
                                {scanning ? 'Scanning for printers...' : 'No printers found'}
                            </Text>
                            <Text style={styles.emptyStateSubtext}>
                                {scanning
                                    ? 'Make sure your printer is turned on'
                                    : 'Tap "Scan" to search for Bluetooth printers'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Instructions Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Instructions</Text>
                    <View style={styles.instructionsCard}>
                        <View style={styles.instructionItem}>
                            <View style={styles.instructionNumber}>
                                <Text style={styles.instructionNumberText}>1</Text>
                            </View>
                            <Text style={styles.instructionText}>
                                Turn on your Bluetooth thermal printer
                            </Text>
                        </View>
                        <View style={styles.instructionItem}>
                            <View style={styles.instructionNumber}>
                                <Text style={styles.instructionNumberText}>2</Text>
                            </View>
                            <Text style={styles.instructionText}>
                                Ensure Bluetooth is enabled on your device
                            </Text>
                        </View>
                        <View style={styles.instructionItem}>
                            <View style={styles.instructionNumber}>
                                <Text style={styles.instructionNumberText}>3</Text>
                            </View>
                            <Text style={styles.instructionText}>
                                Tap "Scan" to find available printers
                            </Text>
                        </View>
                        <View style={styles.instructionItem}>
                            <View style={styles.instructionNumber}>
                                <Text style={styles.instructionNumberText}>4</Text>
                            </View>
                            <Text style={styles.instructionText}>
                                Select a printer to connect and save it
                            </Text>
                        </View>
                        <View style={styles.instructionItem}>
                            <View style={styles.instructionNumber}>
                                <Text style={styles.instructionNumberText}>5</Text>
                            </View>
                            <Text style={styles.instructionText}>
                                Your printer is now ready for sales receipts
                            </Text>
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
        bottom: -40,
        left: -30,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    placeholder: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    savedPrinterCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 2,
        borderColor: '#059669',
    },
    savedPrinterInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    savedPrinterDetails: {
        marginLeft: 16,
        flex: 1,
    },
    savedPrinterName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    savedPrinterType: {
        fontSize: 13,
        color: '#666',
    },
    savedPrinterActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    removeButton: {
        backgroundColor: '#dc2626',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    noPrinterCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    noPrinterText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginTop: 12,
    },
    noPrinterSubtext: {
        fontSize: 13,
        color: '#999',
        marginTop: 4,
        textAlign: 'center',
    },
    scanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3a48c2',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    scanButtonDisabled: {
        backgroundColor: '#9ca3af',
    },
    scanButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    printerList: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    printerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    printerItemSaved: {
        backgroundColor: '#f0fdf4',
    },
    printerIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f0f4ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    printerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    printerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    printerType: {
        fontSize: 12,
        color: '#666',
    },
    printerAction: {
        marginLeft: 8,
    },
    emptyState: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    emptyStateText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
        marginTop: 12,
    },
    emptyStateSubtext: {
        fontSize: 13,
        color: '#999',
        marginTop: 4,
        textAlign: 'center',
    },
    instructionsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    instructionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    instructionNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#3a48c2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    instructionNumberText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    instructionText: {
        flex: 1,
        fontSize: 14,
        color: '#444',
        lineHeight: 20,
    },
});

export default PrinterSettingsScreen;
