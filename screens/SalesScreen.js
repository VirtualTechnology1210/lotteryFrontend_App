import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
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
    RefreshControl,
    Modal,
    Image,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    ToastAndroid
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { categoryService } from '../services/categoryService';
import { productService } from '../services/productService';
import { salesService } from '../services/salesService';
import { getImageUrl, authService } from '../services';
import { invoiceSeriesService } from '../services/invoiceSeriesService';
import PrinterService from '../printer/PrinterService';
import { formatSalesReceipt } from '../printer/lotteryReceiptFormatter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Memoized Category Card for better performance
const CategoryCard = memo(({ category, index, isSelected, onPress }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    const getCategoryIcon = (categoryName) => {
        const name = categoryName?.toLowerCase() || '';
        if (name.includes('lottery')) return 'ticket';
        if (name.includes('game')) return 'gamepad-variant';
        if (name.includes('food')) return 'food';
        if (name.includes('drink')) return 'cup';
        return 'shape';
    };

    const getCategoryColor = (idx) => {
        const colors = ['#3a48c2', '#15803d', '#c2410c', '#7c3aed', '#0891b2', '#be185d'];
        return colors[idx % colors.length];
    };

    const imageUrl = category.category_image ? getImageUrl(category.category_image) : null;
    const showImage = imageUrl && !imageError;

    return (
        <TouchableOpacity
            style={[
                styles.categoryCard,
                isSelected && styles.categoryCardSelected
            ]}
            onPress={onPress}
        >
            {showImage ? (
                <View style={styles.categoryImageContainer}>
                    {imageLoading && (
                        <View style={styles.imagePlaceholder}>
                            <ActivityIndicator size="small" color="#3a48c2" />
                        </View>
                    )}
                    <Image
                        source={{
                            uri: imageUrl,
                            cache: 'force-cache'
                        }}
                        style={[styles.categoryImage, imageLoading && styles.imageHidden]}
                        resizeMode="cover"
                        onLoadEnd={() => setImageLoading(false)}
                        onError={() => {
                            setImageError(true);
                            setImageLoading(false);
                        }}
                    />
                </View>
            ) : (
                <View style={[
                    styles.categoryIconContainer,
                    { backgroundColor: getCategoryColor(index) + '20' }
                ]}>
                    <MaterialCommunityIcons
                        name={getCategoryIcon(category.category_name)}
                        size={28}
                        color={getCategoryColor(index)}
                    />
                </View>
            )}
            <Text style={styles.categoryName} numberOfLines={1}>
                {category.category_name}
            </Text>
            {category.time_slots && category.time_slots.length > 0 && (
                <View style={styles.categoryTimeContainer}>
                    <MaterialCommunityIcons name="clock-outline" size={10} color="#666" />
                    <Text style={styles.categoryTimeText} numberOfLines={1}>
                        {category.time_slots[0]}
                    </Text>
                </View>
            )}
            {isSelected && (
                <View style={styles.selectedBadge}>
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                </View>
            )}
        </TouchableOpacity>
    );
});

// Product Item in Modal
const ProductItem = memo(({ product, onSelect }) => {
    return (
        <TouchableOpacity
            style={styles.productItem}
            onPress={() => onSelect(product)}
        >
            <View style={styles.productItemContent}>
                <View style={styles.productNameRow}>
                    <Text style={styles.productItemName} numberOfLines={2}>
                        {product.product_name}
                    </Text>
                    {product.box === 1 && (
                        <View style={styles.productItemBadge}>
                            <MaterialCommunityIcons name="cube-outline" size={10} color="#fff" />
                            <Text style={styles.productItemBadgeText}>Box</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.productItemCode}>{product.product_code}</Text>
            </View>
            <View style={styles.productItemRight}>
                <Text style={styles.productItemPrice}>₹{product.price}</Text>
                <MaterialCommunityIcons name="plus-circle" size={24} color="#3a48c2" />
            </View>
        </TouchableOpacity>
    );
});

// Cart Item Component
const CartItem = memo(({ item, index, onUpdateQty, onRemove }) => {
    return (
        <View style={styles.cartItem}>
            <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.product_name}</Text>
                <Text style={styles.cartItemPrice}>₹{item.price} × {item.qty}</Text>
            </View>
            <View style={styles.cartItemActions}>
                <View style={styles.qtyControlMini}>
                    <TouchableOpacity
                        style={styles.qtyBtnMini}
                        onPress={() => onUpdateQty(index, Math.max(1, item.qty - 1))}
                    >
                        <MaterialCommunityIcons name="minus" size={16} color="#3a48c2" />
                    </TouchableOpacity>
                    <Text style={styles.qtyTextMini}>{item.qty}</Text>
                    <TouchableOpacity
                        style={styles.qtyBtnMini}
                        onPress={() => onUpdateQty(index, item.qty + 1)}
                    >
                        <MaterialCommunityIcons name="plus" size={16} color="#3a48c2" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.cartItemTotal}>₹{(item.price * item.qty).toFixed(2)}</Text>
                <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => onRemove(index)}
                >
                    <MaterialCommunityIcons name="delete-outline" size={20} color="#dc2626" />
                </TouchableOpacity>
            </View>
        </View>
    );
});

/**
 * Parse a time slot string (e.g. "1:00 PM", "10:30 AM", "15:00")
 * into total minutes from midnight.
 * Returns null if format is invalid.
 */
const parseTimeSlotToMinutes = (timeSlot) => {
    if (!timeSlot || typeof timeSlot !== 'string') return null;
    const trimmed = timeSlot.trim();

    // 12-hour format: "1:00 PM", "10:30 AM"
    const match12h = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12h) {
        let hours = parseInt(match12h[1], 10);
        const minutes = parseInt(match12h[2], 10);
        const meridiem = match12h[3].toUpperCase();
        if (meridiem === 'AM') {
            if (hours === 12) hours = 0;
        } else {
            if (hours !== 12) hours += 12;
        }
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return hours * 60 + minutes;
        }
        return null;
    }

    // 24-hour format: "15:00", "09:30"
    const match24h = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match24h) {
        const hours = parseInt(match24h[1], 10);
        const minutes = parseInt(match24h[2], 10);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return hours * 60 + minutes;
        }
    }
    return null;
};

/**
 * Check if a category should be visible based on its first time slot.
 *
 * Rule:
 *   Hidden from (timeSlot − 2 minutes) until next day 12:01 AM.
 *   Visible from 12:01 AM until (timeSlot − 2 minutes).
 *
 * Example (timeSlot = 1:00 PM = 780 min):
 *   hideStart = 778 min (12:58 PM)
 *   Hidden:  12:58 PM  →  11:59 PM  (same day)
 *            12:00 AM  →  12:00 AM  (next day, 1 minute window)
 *   Visible: 12:01 AM  →  12:57 PM
 */
const isCategoryVisible = (category) => {
    if (!category.time_slots || category.time_slots.length === 0) return true;

    const slotMinutes = parseTimeSlotToMinutes(category.time_slots[0]);
    if (slotMinutes === null) return true; // can't parse → keep visible

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Hide starts 2 minutes before the slot
    let hideStart = slotMinutes - 2;

    if (hideStart < 0) {
        // Slot is at 00:00 or 00:01 — hideStart wraps to previous day
        hideStart += 24 * 60; // e.g. -2 → 1438 (23:58)
    }

    // hideEnd = 12:01 AM = minute 1 of the day
    const hideEnd = 1; // 00:01

    // The hidden window crosses midnight:
    //   hideStart (e.g. 778) → 1439 (end of day) AND 0 → hideEnd (1)
    // So category is HIDDEN when:
    //   currentMinutes >= hideStart  OR  currentMinutes < hideEnd
    if (currentMinutes >= hideStart || currentMinutes < hideEnd) {
        return false; // hidden
    }

    return true; // visible
};

const SalesScreen = ({ navigation }) => {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Tick state — incremented every 30s to force re-evaluation of category visibility
    const [visibilityTick, setVisibilityTick] = useState(0);

    // Permission state
    const [permissions, setPermissions] = useState({
        view: false,
        add: false,
        edit: false,
        del: false
    });

    // Cart state - holds multiple products
    const [cartItems, setCartItems] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Product selection modal
    const [showProductModal, setShowProductModal] = useState(false);

    // Quantity modal for adding to cart
    const [showQtyModal, setShowQtyModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [qty, setQty] = useState('1');
    const [desc, setDesc] = useState('');
    const [lotteryNo, setLotteryNo] = useState('');
    const [permutations, setPermutations] = useState([]);
    const [isBoxProduct, setIsBoxProduct] = useState(false);

    const [showAllCategories, setShowAllCategories] = useState(false);
    const [nextInvoiceNumber, setNextInvoiceNumber] = useState(null);

    // Timer to re-check category visibility every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setVisibilityTick(t => t + 1);
        }, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Filter categories by time-slot visibility, then apply expansion limit
    const visibleCategories = categories.filter(isCategoryVisible);
    const displayedCategories = showAllCategories ? visibleCategories : visibleCategories.slice(0, 6);

    // Calculate total
    const grandTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Load permissions on mount
    useEffect(() => {
        const loadPermissions = async () => {
            try {
                const perms = await authService.getPermissions();
                const salesPerms = perms['sales'] || {};
                setPermissions({
                    view: salesPerms.view || false,
                    add: salesPerms.add || false,
                    edit: salesPerms.edit || false,
                    del: salesPerms.del || false
                });
            } catch (error) {
                console.error('Error loading permissions:', error);
            }
        };
        loadPermissions();
    }, []);

    const fetchNextInvoiceNumber = useCallback(async () => {
        try {
            const series = await invoiceSeriesService.getSeriesByName('sales');
            if (series) {
                setNextInvoiceNumber(series.next_number);
            }
        } catch (error) {
            console.error('Fetch invoice number error:', error);
        }
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
            setRefreshing(false);
        }
    }, []);

    const fetchProductsByCategory = async (categoryId) => {
        setIsLoadingProducts(true);
        setProducts([]);
        try {
            const response = await productService.getProductsByCategory(categoryId, { status: 1 });
            if (response && response.data) {
                setProducts(response.data.products || []);
            }
        } catch (error) {
            console.error('Fetch products error:', error);
            Alert.alert('Error', 'Failed to load products');
        } finally {
            setIsLoadingProducts(false);
        }
    };

    // Refetch categories every time the screen gains focus
    useFocusEffect(
        useCallback(() => {
            fetchCategories();
            fetchNextInvoiceNumber();
        }, [fetchCategories, fetchNextInvoiceNumber])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setSelectedCategory(null);
        setProducts([]);
        fetchCategories();
    }, [fetchCategories]);

    const handleCategoryPress = useCallback((category) => {
        setSelectedCategory(category);
        fetchProductsByCategory(category.id);
        setShowProductModal(true);
    }, []);

    // Generate all permutations of an array
    const generatePermutations = (arr) => {
        if (arr.length <= 1) return [arr];
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            const perms = generatePermutations(rest);
            for (const perm of perms) {
                result.push([arr[i], ...perm]);
            }
        }
        return result;
    };

    // Handle lottery number change for box products
    const handleLotteryNoChange = (text) => {
        // Only allow digits
        const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 5);
        setLotteryNo(digitsOnly);

        if (digitsOnly.length >= 3) {
            const digits = digitsOnly.split('');
            const perms = generatePermutations(digits);
            const permNumbers = [...new Set(perms.map(p => p.join('')))];
            setPermutations(permNumbers);
            setQty(permNumbers.length.toString());
            setDesc(permNumbers.join(', '));
        } else {
            setPermutations([]);
            setQty('1');
            setDesc('');
        }
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setQty('1');
        setDesc('');
        setLotteryNo('');
        setPermutations([]);
        setIsBoxProduct(product.box === 1);
        setShowProductModal(false);
        setShowQtyModal(true);
    };

    const handleAddToCart = () => {
        if (!selectedProduct || !selectedCategory) {
            Alert.alert('Error', 'Please select a product');
            return;
        }

        const quantity = parseInt(qty);
        if (!quantity || quantity < 1) {
            Alert.alert('Validation Error', 'Quantity must be at least 1');
            return;
        }

        // Validate Lottery No (description)
        if (!desc.trim()) {
            Alert.alert('Validation Error', 'Please enter the lottery number');
            return;
        }

        const newItem = {
            category_id: selectedCategory.id,
            category_name: selectedCategory.category_name,
            time_slots: selectedCategory.time_slots, // Include time slots for receipt printing
            product_id: selectedProduct.id,
            product_name: selectedProduct.product_name,
            product_code: selectedProduct.product_code,
            price: selectedProduct.price,
            qty: quantity,
            desc: desc.trim()
        };

        // Check if product already exists in cart
        const existingIndex = cartItems.findIndex(item => item.product_id === selectedProduct.id);
        if (existingIndex >= 0) {
            // Update quantity
            const updatedItems = [...cartItems];
            updatedItems[existingIndex].qty += quantity;
            if (desc.trim()) {
                updatedItems[existingIndex].desc = desc.trim();
            }
            setCartItems(updatedItems);
        } else {
            setCartItems([...cartItems, newItem]);
        }

        setShowQtyModal(false);
        setSelectedProduct(null);
        setSelectedCategory(null);
        setQty('1');
        setDesc('');
    };

    const handleUpdateCartQty = (index, newQty) => {
        const updatedItems = [...cartItems];
        updatedItems[index].qty = newQty;
        setCartItems(updatedItems);
    };

    const handleRemoveFromCart = (index) => {
        Alert.alert(
            'Remove Item',
            'Are you sure you want to remove this item from cart?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        const updatedItems = cartItems.filter((_, i) => i !== index);
                        setCartItems(updatedItems);
                    }
                }
            ]
        );
    };

    const handleClearCart = () => {
        Alert.alert(
            'Clear Cart',
            'Are you sure you want to remove all items from cart?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: () => setCartItems([])
                }
            ]
        );
    };

    // Print receipt via Bluetooth (uses persistent connection for speed)
    const handlePrintReceipt = async (invoiceNo, items, username) => {
        try {
            // Format receipt
            const receiptBytes = formatSalesReceipt({
                username: username,
                invoiceNo: invoiceNo,
                cartItems: items,
            }, '80');

            // Print using persistent connection (stays connected for next print)
            await PrinterService.printWithPersistentConnection(receiptBytes);

            console.log('[Print] Receipt printed successfully');
        } catch (error) {
            console.error('[Print] Error:', error);
            const msg = error.message || 'Failed to print receipt';

            // Check if it's a "no printer" error
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
        }
    };

    const handleSubmitSales = async () => {
        if (cartItems.length === 0) {
            Alert.alert('Error', 'Please add at least one product to cart');
            return;
        }

        setIsSubmitting(true);
        try {
            // Submit all items as a batch with single invoice
            const items = cartItems.map(item => ({
                product_id: item.product_id,
                qty: item.qty,
                desc: item.desc || null
            }));

            const response = await salesService.createBatchSales(items);

            // Extract invoice number from response
            const invoiceNumber = response.data?.invoice_number || 'N/A';
            const itemsCount = response.data?.items_count || cartItems.length;

            // Get username for receipt
            const { user: userData } = await authService.getAuthData();
            const username = userData?.name || userData?.username || 'User';

            // Keep a copy of cart items for printing
            const itemsToPrint = [...cartItems];

            // Clear cart first
            setCartItems([]);
            fetchNextInvoiceNumber();

            // Show success with print option
            Alert.alert(
                '✓ Sale Complete',
                `Invoice: ${invoiceNumber}\nItems: ${itemsCount}\nGrand Total: ₹${grandTotal.toFixed(2)}`,
                [
                    { text: 'Done', style: 'cancel' },
                    {
                        text: 'Print Receipt',
                        onPress: () => handlePrintReceipt(invoiceNumber, itemsToPrint, username)
                    }
                ]
            );
        } catch (error) {
            console.error('Submit sales error:', error);
            const msg = error.response?.data?.message || 'Failed to create sales';
            Alert.alert('Error', msg);
        } finally {
            setIsSubmitting(false);
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
                    <Text style={styles.headerTitle}>New Sale</Text>
                    <View style={styles.addButtonPlaceholder} />
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3a48c2" />
                }
            >
                {!permissions.add ? (
                    <View style={styles.noPermissionContainer}>
                        <MaterialCommunityIcons name="lock-outline" size={80} color="#ddd" />
                        <Text style={styles.noPermissionTitle}>No Permission</Text>
                        <Text style={styles.noPermissionText}>
                            You don't have permission to create sales.{'\n'}
                            Please contact your administrator.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Categories Grid */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Select Category</Text>
                            <Text style={styles.sectionSubtitle}>Tap a category to view and select products</Text>
                            <View style={styles.categoryGrid}>
                                {displayedCategories.map((category, index) => (
                                    <CategoryCard
                                        key={category.id}
                                        category={category}
                                        index={index}
                                        isSelected={false}
                                        onPress={() => handleCategoryPress(category)}
                                    />
                                ))}
                            </View>

                            {/* Show More / Show Less Button */}
                            {visibleCategories.length > 6 && (
                                <TouchableOpacity
                                    style={styles.showMoreButton}
                                    onPress={() => setShowAllCategories(!showAllCategories)}
                                >
                                    <Text style={styles.showMoreText}>
                                        {showAllCategories ? 'Show Less' : `Show All (${visibleCategories.length})`}
                                    </Text>
                                    <MaterialCommunityIcons
                                        name={showAllCategories ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color="#3a48c2"
                                    />
                                </TouchableOpacity>
                            )}

                            {visibleCategories.length === 0 && (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons name="shape-outline" size={50} color="#ddd" />
                                    <Text style={styles.emptyText}>{categories.length > 0 ? 'All categories are currently closed' : 'No categories available'}</Text>
                                </View>
                            )}
                        </View>

                        {/* Cart Section */}
                        {cartItems.length > 0 && (
                            <View style={styles.cartSection}>
                                <View style={styles.cartHeader}>
                                    <View style={styles.cartTitleRow}>
                                        <MaterialCommunityIcons name="receipt" size={22} color="#3a48c2" />
                                        <Text style={styles.cartTitle}>Invoice: {nextInvoiceNumber || '...'}</Text>
                                    </View>
                                    <TouchableOpacity onPress={handleClearCart}>
                                        <Text style={styles.clearAllText}>Clear All</Text>
                                    </TouchableOpacity>
                                </View>

                                {cartItems.map((item, index) => (
                                    <CartItem
                                        key={`${item.product_id}-${index}`}
                                        item={item}
                                        index={index}
                                        onUpdateQty={handleUpdateCartQty}
                                        onRemove={handleRemoveFromCart}
                                    />
                                ))}

                                {/* Grand Total */}
                                <View style={styles.grandTotalContainer}>
                                    <Text style={styles.grandTotalLabel}>Grand Total</Text>
                                    <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
                                </View>
                            </View>
                        )}

                        {/* Empty Cart State */}
                        {cartItems.length === 0 && (
                            <View style={styles.emptyCartState}>
                                <MaterialCommunityIcons name="cart-outline" size={60} color="#ddd" />
                                <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
                                <Text style={styles.emptyCartText}>Tap on a category above to add products</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            {/* Bottom Submit Button */}
            {permissions.add && cartItems.length > 0 && (
                <View style={styles.bottomBar}>
                    <View style={styles.bottomBarContent}>
                        <View style={styles.bottomBarInfo}>
                            <Text style={styles.bottomBarItems}>{cartItems.length} item(s)</Text>
                            <Text style={styles.bottomBarTotal}>₹{grandTotal.toFixed(2)}</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                            onPress={handleSubmitSales}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
                                    <Text style={styles.submitButtonText}>Submit </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Products Modal */}
            <Modal
                visible={showProductModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowProductModal(false);
                    setSelectedCategory(null);
                    setProducts([]);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.productModalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Select Product</Text>
                                {selectedCategory && (
                                    <Text style={styles.modalSubtitle}>{selectedCategory.category_name}</Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => {
                                    setShowProductModal(false);
                                    setSelectedCategory(null);
                                    setProducts([]);
                                }}
                            >
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {isLoadingProducts ? (
                            <View style={styles.loadingProducts}>
                                <ActivityIndicator size="large" color="#3a48c2" />
                                <Text style={styles.loadingText}>Loading products...</Text>
                            </View>
                        ) : products.length > 0 ? (
                            <FlatList
                                data={products}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <ProductItem product={item} onSelect={handleProductSelect} />
                                )}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.productList}
                            />
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="package-variant-closed" size={60} color="#ddd" />
                                <Text style={styles.emptyText}>No products in this category</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Quantity Modal */}
            <Modal
                visible={showQtyModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowQtyModal(false);
                    setSelectedProduct(null);
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={styles.qtyModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Products</Text>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => {
                                    setShowQtyModal(false);
                                    setSelectedProduct(null);
                                }}
                            >
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {selectedProduct && (
                                <>
                                    {/* Product Info */}
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productInfoName}>{selectedProduct.product_name}</Text>
                                        <Text style={styles.productInfoCode}>{selectedProduct.product_code}</Text>
                                        <View style={styles.priceRow}>
                                            <Text style={styles.priceLabel}>Unit Price:</Text>
                                            <Text style={styles.priceValue}>₹{selectedProduct.price}</Text>
                                        </View>
                                    </View>

                                    {/* Lottery No Input - Different for box products */}
                                    {isBoxProduct ? (
                                        <>
                                            <View style={styles.inputGroup}>
                                                <View style={styles.labelRow}>
                                                    <Text style={styles.label}>Lottery No *</Text>
                                                    <View style={styles.boxBadge}>
                                                        <MaterialCommunityIcons name="cube-outline" size={14} color="#fff" />
                                                        <Text style={styles.boxBadgeText}>Box</Text>
                                                    </View>
                                                </View>
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="Enter lottery digits"
                                                    value={lotteryNo}
                                                    onChangeText={handleLotteryNoChange}
                                                    keyboardType="numeric"
                                                    placeholderTextColor="#999"
                                                    maxLength={6}
                                                />
                                            </View>

                                            {/* Permutations Display */}
                                            {permutations.length > 0 && (
                                                <View style={styles.inputGroup}>
                                                    <View style={styles.permHeaderRow}>
                                                        <Text style={styles.label}>
                                                            All Permutations ({permutations.length})
                                                        </Text>
                                                        <View style={styles.permCountBadge}>
                                                            <Text style={styles.permCountText}>
                                                                Qty: {permutations.length}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <View style={styles.permutationsContainer}>
                                                        <ScrollView
                                                            style={styles.permutationsScroll}
                                                            nestedScrollEnabled={true}
                                                        >
                                                            <View style={styles.permutationsGrid}>
                                                                {permutations.map((perm, idx) => (
                                                                    <View key={idx} style={styles.permChip}>
                                                                        <Text style={styles.permChipText}>{perm}</Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        </ScrollView>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Quantity (auto-set, read-only for box) */}
                                            <View style={styles.inputGroup}>
                                                <Text style={styles.label}>Quantity</Text>
                                                <View style={styles.qtyContainer}>
                                                    <TextInput
                                                        style={[styles.qtyInput, styles.qtyInputDisabled]}
                                                        value={qty}
                                                        editable={false}
                                                        textAlign="center"
                                                    />
                                                </View>
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            {/* Normal Quantity Input */}
                                            <View style={styles.inputGroup}>
                                                <Text style={styles.label}>Quantity *</Text>
                                                <View style={styles.qtyContainer}>
                                                    <TouchableOpacity
                                                        style={styles.qtyBtn}
                                                        onPress={() => {
                                                            const newQty = Math.max(1, parseInt(qty || 1) - 1);
                                                            setQty(newQty.toString());
                                                        }}
                                                    >
                                                        <MaterialCommunityIcons name="minus" size={24} color="#3a48c2" />
                                                    </TouchableOpacity>
                                                    <TextInput
                                                        style={styles.qtyInput}
                                                        value={qty}
                                                        onChangeText={setQty}
                                                        keyboardType="numeric"
                                                        textAlign="center"
                                                    />
                                                    <TouchableOpacity
                                                        style={styles.qtyBtn}
                                                        onPress={() => {
                                                            const newQty = parseInt(qty || 0) + 1;
                                                            setQty(newQty.toString());
                                                        }}
                                                    >
                                                        <MaterialCommunityIcons name="plus" size={24} color="#3a48c2" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Normal Lottery No */}
                                            <View style={styles.inputGroup}>
                                                <Text style={styles.label}>Lottery No *</Text>
                                                <TextInput
                                                    style={[styles.input, styles.textArea]}
                                                    placeholder="Enter lottery number"
                                                    value={desc}
                                                    onChangeText={setDesc}
                                                    placeholderTextColor="#999"
                                                    multiline
                                                    numberOfLines={3}
                                                />
                                            </View>
                                        </>
                                    )}

                                    {/* Total Preview */}
                                    <View style={styles.totalContainer}>
                                        <Text style={styles.totalLabel}>Item Total</Text>
                                        <Text style={styles.totalValue}>
                                            ₹{(selectedProduct.price * (parseInt(qty) || 0)).toFixed(2)}
                                        </Text>
                                    </View>

                                    {/* Add to Cart Button */}
                                    <TouchableOpacity
                                        style={styles.addToCartButton}
                                        onPress={handleAddToCart}
                                    >
                                        <MaterialCommunityIcons name="cart-plus" size={22} color="#fff" />
                                        <Text style={styles.addToCartButtonText}>Add</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
    cartBadgeContainer: {
        position: 'relative',
        padding: 10,
    },
    cartBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#dc2626',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#888',
        marginBottom: 15,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 10,
    },
    categoryCard: {
        width: (SCREEN_WIDTH - 40 - 20) / 3,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        borderWidth: 2,
        borderColor: 'transparent',
        marginBottom: 2,
    },
    categoryCardSelected: {
        borderColor: '#3a48c2',
        backgroundColor: '#EEF0FF',
    },
    categoryIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryImageContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginBottom: 8,
        overflow: 'hidden',
        backgroundColor: '#F0F0F0',
    },
    categoryImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    imagePlaceholder: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageHidden: {
        opacity: 0,
    },
    categoryName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1a1a1a',
        textAlign: 'center',
        paddingHorizontal: 4,
        marginBottom: 2,
    },
    categoryTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#F5F7FA',
        borderRadius: 8,
    },
    categoryTimeText: {
        fontSize: 10,
        color: '#666',
        fontWeight: '500',
    },
    selectedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#3a48c2',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    showMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
        padding: 10,
        gap: 5,
    },
    showMoreText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3a48c2',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
        marginTop: 10,
    },
    // Cart Section
    cartSection: {
        margin: 20,
        marginTop: 0,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
    },
    cartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    cartTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    clearAllText: {
        fontSize: 14,
        color: '#dc2626',
        fontWeight: '600',
    },
    cartItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    cartItemInfo: {
        flex: 1,
        marginRight: 10,
    },
    cartItemCategory: {
        fontSize: 11,
        color: '#3a48c2',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    cartItemCategoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    cartItemTimeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF0FF',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        gap: 3,
    },
    cartItemTimeText: {
        fontSize: 9,
        color: '#3a48c2',
        fontWeight: '700',
    },
    cartItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    cartItemPrice: {
        fontSize: 12,
        color: '#888',
    },
    cartItemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    qtyControlMini: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF0FF',
        borderRadius: 8,
        padding: 4,
    },
    qtyBtnMini: {
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyTextMini: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1a1a1a',
        paddingHorizontal: 8,
    },
    cartItemTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#15803d',
        minWidth: 60,
        textAlign: 'right',
    },
    removeBtn: {
        padding: 4,
    },
    grandTotalContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 2,
        borderTopColor: '#f0f0f0',
    },
    grandTotalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    grandTotalValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#15803d',
    },
    // Empty Cart State
    emptyCartState: {
        alignItems: 'center',
        paddingVertical: 60,
        marginHorizontal: 20,
    },
    emptyCartTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
        marginTop: 16,
    },
    emptyCartText: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
        textAlign: 'center',
    },
    // Bottom Bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingHorizontal: 20,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 28 : 12,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    bottomBarContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bottomBarInfo: {
        flex: 1,
    },
    bottomBarItems: {
        fontSize: 13,
        color: '#888',
    },
    bottomBarTotal: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    submitButton: {
        backgroundColor: '#1540ccff',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
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
    // Product Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    productModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '75%',
        minHeight: '50%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#3a48c2',
        marginTop: 4,
        fontWeight: '600',
    },
    productList: {
        paddingBottom: 20,
    },
    productItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8F9FD',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    productItemContent: {
        flex: 1,
        marginRight: 12,
    },
    productItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    productItemCode: {
        fontSize: 12,
        color: '#888',
    },
    productNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    productItemBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3a48c2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        gap: 2,
    },
    productItemBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    productItemRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    productItemPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15803d',
    },
    loadingProducts: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    loadingText: {
        color: '#666',
        fontSize: 14,
    },
    // Quantity Modal
    qtyModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
    },
    productInfo: {
        backgroundColor: '#F8F9FD',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
    },
    productInfoName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    productInfoCode: {
        fontSize: 12,
        color: '#888',
        marginBottom: 10,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 14,
        color: '#666',
    },
    priceValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15803d',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
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
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    qtyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    qtyBtn: {
        width: 48,
        height: 48,
        backgroundColor: '#EEF0FF',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyInput: {
        flex: 1,
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        padding: 14,
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    totalContainer: {
        backgroundColor: '#15803d10',
        padding: 15,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    totalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#15803d',
    },
    addToCartButton: {
        backgroundColor: '#3a48c2',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
    },
    addToCartButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    continueShoppingBtn: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#3a48c2',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
    },
    continueShoppingText: {
        color: '#3a48c2',
        fontSize: 14,
        fontWeight: '600',
    },
    // Box Permutation Styles
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    boxBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3a48c2',
        paddingHorizontal: 10,
        paddingVertical: 4,
        gap: 4,
    },
    boxBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    permHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    permCountBadge: {
        backgroundColor: '#3a48c2',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    permCountText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    permutationsContainer: {
        backgroundColor: '#F0F1FF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D0D4FF',
        padding: 10,
    },
    permutationsScroll: {
        maxHeight: 160,
    },
    permutationsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    permChip: {
        backgroundColor: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3a48c2',
        elevation: 1,
        shadowColor: '#3a48c2',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    permChipText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3a48c2',
        letterSpacing: 1,
    },
    qtyInputDisabled: {
        backgroundColor: '#E8E8E8',
        color: '#666',
    },
});

export default SalesScreen;
