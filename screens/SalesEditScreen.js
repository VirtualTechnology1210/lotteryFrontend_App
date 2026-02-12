import React, { useState, useEffect } from 'react';
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
    ToastAndroid,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { salesService } from '../services/salesService';
import { authService } from '../services';
import PrinterService from '../printer/PrinterService';
import { formatSalesReceipt } from '../printer/lotteryReceiptFormatter';

const SalesEditScreen = ({ navigation, route }) => {
    const { saleId, saleData, isMultiple, salesItems, groupTotal } = route.params || {};
    const [isPrinting, setIsPrinting] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // For single item editing
    const [formData, setFormData] = useState({
        product_name: '',
        product_code: '',
        qty: '',
        unit_price: '',
        total: '',
        desc: '',
    });

    // For multiple items editing
    const [multipleItems, setMultipleItems] = useState([]);
    const [multipleTotal, setMultipleTotal] = useState(0);

    useEffect(() => {
        if (isMultiple && salesItems) {
            // Initialize multiple items
            const items = salesItems.map(item => ({
                id: item.id,
                product_name: item.product_name || '',
                product_code: item.product_code || '',
                qty: String(item.qty || ''),
                unit_price: String(item.unit_price || ''),
                total: String(item.total || ''),
                desc: item.desc || '',
            }));
            setMultipleItems(items);
            setMultipleTotal(groupTotal || 0);
        } else if (saleData) {
            // Pre-populate form with existing sale data
            setFormData({
                product_name: saleData.product_name || '',
                product_code: saleData.product_code || '',
                qty: String(saleData.qty || ''),
                unit_price: String(saleData.unit_price || ''),
                total: String(saleData.total || ''),
                desc: saleData.desc || '',
            });
        } else if (saleId) {
            // Fetch sale data if only ID is provided
            fetchSaleData();
        }
    }, [saleId, saleData, isMultiple, salesItems]);

    const fetchSaleData = async () => {
        setIsLoading(true);
        try {
            const response = await salesService.getSaleById(saleId);
            if (response && response.data) {
                const sale = response.data;
                setFormData({
                    product_name: sale.product_name || '',
                    product_code: sale.product_code || '',
                    qty: String(sale.qty || ''),
                    unit_price: String(sale.unit_price || ''),
                    total: String(sale.total || ''),
                    desc: sale.desc || '',
                });
            }
        } catch (error) {
            console.error('Fetch sale error:', error);
            Alert.alert('Error', 'Failed to load sale data');
            navigation.goBack();
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };

            // Auto-calculate total when qty or unit_price changes
            if (field === 'qty' || field === 'unit_price') {
                const qty = parseFloat(field === 'qty' ? value : updated.qty) || 0;
                const unitPrice = parseFloat(field === 'unit_price' ? value : updated.unit_price) || 0;
                updated.total = String((qty * unitPrice).toFixed(2));
            }

            return updated;
        });
    };

    const handleMultipleInputChange = (index, field, value) => {
        setMultipleItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };

            // Auto-calculate total when qty or unit_price changes
            if (field === 'qty' || field === 'unit_price') {
                const qty = parseFloat(field === 'qty' ? value : updated[index].qty) || 0;
                const unitPrice = parseFloat(field === 'unit_price' ? value : updated[index].unit_price) || 0;
                updated[index].total = String((qty * unitPrice).toFixed(2));
            }

            // Recalculate group total
            const newTotal = updated.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
            setMultipleTotal(newTotal);

            return updated;
        });
    };

    const validateForm = () => {
        if (!isMultiple) {
            const qty = parseFloat(formData.qty);
            if (isNaN(qty) || qty <= 0) {
                Alert.alert('Validation Error', 'Please enter a valid quantity');
                return false;
            }

            const unitPrice = parseFloat(formData.unit_price);
            if (isNaN(unitPrice) || unitPrice <= 0) {
                Alert.alert('Validation Error', 'Please enter a valid unit price');
                return false;
            }
        } else {
            for (let i = 0; i < multipleItems.length; i++) {
                const item = multipleItems[i];
                const qty = parseFloat(item.qty);
                if (isNaN(qty) || qty <= 0) {
                    Alert.alert('Validation Error', `Please enter a valid quantity for ${item.product_name}`);
                    return false;
                }

                const unitPrice = parseFloat(item.unit_price);
                if (isNaN(unitPrice) || unitPrice <= 0) {
                    Alert.alert('Validation Error', `Please enter a valid unit price for ${item.product_name}`);
                    return false;
                }
            }
        }

        return true;
    };

    // Print receipt via Bluetooth (matches SalesScreen's print logic)
    const handlePrintReceipt = async (items) => {
        setIsPrinting(true);
        try {
            // Get username for receipt
            const { user: userData } = await authService.getAuthData();
            const username = userData?.name || userData?.username || 'User';

            // Build cart-like items for the receipt formatter
            const cartItems = items.map(item => ({
                category_name: item.category_name || item.product_category || '',
                time_slots: item.time_slots || null,
                product_name: item.product_name || '',
                product_code: item.product_code || '',
                price: parseFloat(item.unit_price) || 0,
                qty: parseInt(item.qty) || 1,
                desc: item.desc || '',
            }));

            // Determine invoice number
            const invoiceNo = items[0]?.invoice_number || saleData?.invoice_number || 'N/A';

            // Format receipt
            const receiptBytes = formatSalesReceipt({
                username: username,
                invoiceNo: invoiceNo,
                cartItems: cartItems,
            }, '80');

            // Print using persistent connection
            await PrinterService.printWithPersistentConnection(receiptBytes);

            console.log('[Print] Edit receipt printed successfully');
        } catch (error) {
            console.error('[Print] Error:', error);
            const msg = error.message || 'Failed to print receipt';

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
            } else {
                console.warn('Print Error:', msg);
            }
        } finally {
            setIsPrinting(false);
        }
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setIsSaving(true);
        try {
            if (!isMultiple) {
                // Single item update
                const updateData = {
                    qty: parseInt(formData.qty),
                    price: parseFloat(formData.total), // Send total amount as price
                    desc: formData.desc.trim() || null,
                };
                await salesService.updateSale(saleId || saleData.id, updateData);
            } else {
                // Multiple items update - update each item
                const updatePromises = multipleItems.map(item => {
                    const updateData = {
                        qty: parseInt(item.qty),
                        price: parseFloat(item.total), // Send total amount as price
                        desc: item.desc.trim() || null,
                    };
                    return salesService.updateSale(item.id, updateData);
                });
                await Promise.all(updatePromises);
            }

            // Build the items data for print
            const printItems = isMultiple
                ? multipleItems.map(item => ({
                    ...item,
                    invoice_number: item.invoice_number || salesItems?.[0]?.invoice_number,
                    category_name: item.category_name || salesItems?.[0]?.category_name,
                    time_slots: item.time_slots || salesItems?.[0]?.time_slots,
                }))
                : [{
                    ...formData,
                    id: saleId || saleData?.id,
                    invoice_number: saleData?.invoice_number,
                    category_name: saleData?.category_name,
                    time_slots: saleData?.time_slots,
                }];

            // Note: Data refresh is handled automatically via useFocusEffect in ReportResultScreen

            Alert.alert(
                '✓ Updated',
                isMultiple ? 'All sales updated successfully' : 'Sale updated successfully',
                [
                    {
                        text: 'Done',
                        onPress: () => navigation.goBack()
                    },
                    {
                        text: 'Print Receipt',
                        onPress: () => {
                            handlePrintReceipt(printItems);
                            navigation.goBack();
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Update sale error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to update sale');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        const message = isMultiple
            ? `Are you sure you want to delete all ${multipleItems.length} sales? This action cannot be undone.`
            : 'Are you sure you want to delete this sale? This action cannot be undone.';

        Alert.alert(
            'Confirm Delete',
            message,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: deleteSales }
            ]
        );
    };

    const deleteSales = async () => {
        setIsSaving(true);
        try {
            if (!isMultiple) {
                await salesService.deleteSale(saleId || saleData.id);
            } else {
                // Delete all items in the group
                const deletePromises = multipleItems.map(item => salesService.deleteSale(item.id));
                await Promise.all(deletePromises);
            }

            // Note: Data refresh is handled automatically via useFocusEffect in ReportResultScreen

            Alert.alert(
                'Success',
                isMultiple ? 'All sales deleted successfully' : 'Sale deleted successfully',
                [{
                    text: 'OK',
                    onPress: () => navigation.goBack()
                }]
            );
        } catch (error) {
            console.error('Delete sale error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete sale');
        } finally {
            setIsSaving(false);
        }
    };

    const renderSingleItemForm = () => (
        <>
            {/* Product Information Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="package-variant" size={24} color="#3a48c2" />
                    <Text style={styles.cardTitle}>Product Information</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Product Name</Text>
                    <TextInput
                        style={[styles.input, styles.inputReadOnly]}
                        value={formData.product_name}
                        placeholder="Product name"
                        placeholderTextColor="#999"
                        editable={false}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Product Code</Text>
                    <TextInput
                        style={[styles.input, styles.inputReadOnly]}
                        value={formData.product_code}
                        placeholder="Product code"
                        placeholderTextColor="#999"
                        editable={false}
                    />
                </View>
            </View>

            {/* Pricing Information Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="currency-inr" size={24} color="#15803d" />
                    <Text style={styles.cardTitle}>Pricing Details</Text>
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                        <Text style={styles.label}>Quantity *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.qty}
                            onChangeText={(value) => handleInputChange('qty', value)}
                            placeholder="0"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={[styles.inputGroup, styles.halfWidth]}>
                        <Text style={styles.label}>Unit Price *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.unit_price}
                            onChangeText={(value) => handleInputChange('unit_price', value)}
                            placeholder="0.00"
                            placeholderTextColor="#999"
                            keyboardType="decimal-pad"
                        />
                    </View>
                </View>

                <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>₹{formData.total || '0.00'}</Text>
                </View>
            </View>

            {/* Additional Notes Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="note-text-outline" size={24} color="#c2410c" />
                    <Text style={styles.cardTitle}>Lottery Number</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Numbers</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={formData.desc}
                        onChangeText={(value) => handleInputChange('desc', value)}
                        placeholder="Enter any additional notes (optional)"
                        placeholderTextColor="#999"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>
            </View>
        </>
    );

    const renderMultipleItemsForm = () => (
        <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <MaterialCommunityIcons name="basket-outline" size={28} color="#3a48c2" />
                    <View style={styles.summaryInfo}>
                        <Text style={styles.summaryTitle}>{multipleItems.length} Items</Text>
                        <Text style={styles.summarySubtitle}>Edit all items in this batch</Text>
                    </View>
                </View>
                <View style={styles.summaryTotalContainer}>
                    <Text style={styles.summaryTotalLabel}>Batch Total</Text>
                    <Text style={styles.summaryTotalValue}>₹{multipleTotal.toFixed(2)}</Text>
                </View>
            </View>

            {/* Individual Items */}
            {multipleItems.map((item, index) => (
                <View key={item.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.itemBadge}>
                            <Text style={styles.itemBadgeText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.cardTitle} numberOfLines={1}>{item.product_name}</Text>
                    </View>

                    {item.product_code ? (
                        <View style={styles.codeBadge}>
                            <Text style={styles.codeText}>{item.product_code}</Text>
                        </View>
                    ) : null}

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>Quantity *</Text>
                            <TextInput
                                style={styles.input}
                                value={item.qty}
                                onChangeText={(value) => handleMultipleInputChange(index, 'qty', value)}
                                placeholder="0"
                                placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>Unit Price *</Text>
                            <TextInput
                                style={styles.input}
                                value={item.unit_price}
                                onChangeText={(value) => handleMultipleInputChange(index, 'unit_price', value)}
                                placeholder="0.00"
                                placeholderTextColor="#999"
                                keyboardType="decimal-pad"
                            />
                        </View>
                    </View>

                    <View style={styles.itemTotalRow}>
                        <Text style={styles.itemTotalLabel}>Item Total:</Text>
                        <Text style={styles.itemTotalValue}>₹{item.total || '0.00'}</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Notes</Text>
                        <TextInput
                            style={[styles.input, styles.smallTextArea]}
                            value={item.desc}
                            onChangeText={(value) => handleMultipleInputChange(index, 'desc', value)}
                            placeholder="Optional notes"
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={2}
                            textAlignVertical="top"
                        />
                    </View>
                </View>
            ))}
        </>
    );

    if (isLoading) {
        return (
            <View style={styles.container}>
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
                        <Text style={styles.headerTitle}>Edit Sale</Text>
                        <View style={styles.headerPlaceholder} />
                    </View>
                </LinearGradient>

                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3a48c2" />
                    <Text style={styles.loadingText}>Loading sale data...</Text>
                </View>
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
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />

                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {isMultiple ? `Edit ${multipleItems.length} Items` : 'Edit Sale'}
                    </Text>
                    <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                        <MaterialCommunityIcons name="delete-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {isMultiple ? renderMultipleItemsForm() : renderSingleItemForm()}

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => navigation.goBack()}
                        disabled={isSaving}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                                <Text style={styles.saveButtonText}>
                                    {isMultiple ? 'Save All' : 'Save Changes'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
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
        marginBottom: 16,
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
    deleteButton: {
        backgroundColor: 'rgba(220, 38, 38, 0.2)',
        padding: 10,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(220, 38, 38, 0.3)',
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
    headerPlaceholder: {
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
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 30,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#3a48c2',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E4F0',
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    summaryInfo: {
        marginLeft: 12,
        flex: 1,
    },
    summaryTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    summarySubtitle: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    summaryTotalContainer: {
        backgroundColor: '#F0FDF4',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    summaryTotalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#15803d',
    },
    summaryTotalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#15803d',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginLeft: 10,
        flex: 1,
    },
    itemBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#3a48c2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemBadgeText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
    codeBadge: {
        backgroundColor: '#EEF0FF',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 12,
    },
    codeText: {
        fontSize: 12,
        color: '#3a48c2',
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F8F9FD',
        borderWidth: 1,
        borderColor: '#E0E4F0',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: '#1a1a1a',
    },
    inputReadOnly: {
        backgroundColor: '#f5f5f5',
        color: '#666',
    },
    textArea: {
        height: 100,
        paddingTop: 14,
    },
    smallTextArea: {
        height: 60,
        paddingTop: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    totalContainer: {
        backgroundColor: '#F0FDF4',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#15803d',
    },
    totalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#15803d',
    },
    itemTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8F9FD',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    itemTotalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    itemTotalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15803d',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#E0E4F0',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#3a48c2',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        elevation: 2,
        shadowColor: '#3a48c2',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    saveButtonDisabled: {
        backgroundColor: '#9ca3af',
        elevation: 0,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default SalesEditScreen;
