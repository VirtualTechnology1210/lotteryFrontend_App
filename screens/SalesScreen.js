import React, { useState, useCallback, memo } from 'react';
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
    Dimensions
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { categoryService } from '../services/categoryService';
import { productService } from '../services/productService';
import { salesService } from '../services/salesService';
import { getImageUrl } from '../services';

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
            <Text style={styles.categoryName} numberOfLines={2}>
                {category.category_name}
            </Text>
            {isSelected && (
                <View style={styles.selectedBadge}>
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                </View>
            )}
        </TouchableOpacity>
    );
});

const SalesScreen = ({ navigation }) => {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Sale form state
    const [qty, setQty] = useState('1');
    const [desc, setDesc] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSaleModal, setShowSaleModal] = useState(false);

    const [showAllCategories, setShowAllCategories] = useState(false);

    // Categories to display based on expansion state
    const displayedCategories = showAllCategories ? categories : categories.slice(0, 3);

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
        }, [fetchCategories])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setSelectedCategory(null);
        setSelectedProduct(null);
        setProducts([]);
        fetchCategories();
    }, [fetchCategories]);

    const handleCategorySelect = useCallback((category) => {
        setSelectedCategory(category);
        setSelectedProduct(null);
        fetchProductsByCategory(category.id);
    }, []);

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setQty('1');
        setDesc('');
        setShowSaleModal(true);
    };

    const handleSubmitSale = async () => {
        if (!selectedProduct) {
            Alert.alert('Error', 'Please select a product');
            return;
        }

        const quantity = parseInt(qty);
        if (!quantity || quantity < 1) {
            Alert.alert('Validation Error', 'Quantity must be at least 1');
            return;
        }

        setIsSubmitting(true);
        try {
            const saleData = {
                product_id: selectedProduct.id,
                qty: quantity,
                desc: desc.trim() || null
            };

            await salesService.createSale(saleData);

            Alert.alert('Success', `Sale recorded successfully!\n\n${selectedProduct.product_name}\nQty: ${quantity}\nUnit Price: ₹${selectedProduct.price}\nTotal: ₹${(selectedProduct.price * quantity).toFixed(2)}`);

            setShowSaleModal(false);
            setSelectedProduct(null);
            setQty('1');
            setDesc('');
        } catch (error) {
            console.error('Submit sale error:', error);
            const msg = error.response?.data?.message || 'Failed to create sale';
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
                colors={['#3a48c2', '#2a38a0']}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
                        <MaterialCommunityIcons name="menu" size={26} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Sale</Text>
                    <View style={styles.menuButton} />
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3a48c2" />
                }
            >
                {/* Categories Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Select Category</Text>
                    <View style={styles.categoryGrid}>
                        {displayedCategories.map((category, index) => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                index={index}
                                isSelected={selectedCategory?.id === category.id}
                                onPress={() => handleCategorySelect(category)}
                            />
                        ))}
                    </View>

                    {/* Show More / Show Less Button */}
                    {categories.length > 3 && (
                        <TouchableOpacity
                            style={styles.showMoreButton}
                            onPress={() => setShowAllCategories(!showAllCategories)}
                        >
                            <Text style={styles.showMoreText}>
                                {showAllCategories ? 'Show Less' : 'Show More'}
                            </Text>
                            <MaterialCommunityIcons
                                name={showAllCategories ? 'chevron-up' : 'chevron-down'}
                                size={20}
                                color="#3a48c2"
                            />
                        </TouchableOpacity>
                    )}

                    {categories.length === 0 && (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="shape-outline" size={50} color="#ddd" />
                            <Text style={styles.emptyText}>No categories available</Text>
                        </View>
                    )}
                </View>

                {/* Products Grid */}
                {selectedCategory && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Products in {selectedCategory.category_name}</Text>
                            <TouchableOpacity onPress={() => {
                                setSelectedCategory(null);
                                setProducts([]);
                            }}>
                                <Text style={styles.clearText}>Clear</Text>
                            </TouchableOpacity>
                        </View>

                        {isLoadingProducts ? (
                            <View style={styles.loadingProducts}>
                                <ActivityIndicator size="small" color="#3a48c2" />
                                <Text style={styles.loadingText}>Loading products...</Text>
                            </View>
                        ) : products.length > 0 ? (
                            <View style={styles.productGrid}>
                                {products.map((product) => (
                                    <TouchableOpacity
                                        key={product.id}
                                        style={styles.productCard}
                                        onPress={() => handleProductSelect(product)}
                                    >
                                        <Text style={styles.productName} numberOfLines={2}>
                                            {product.product_name}
                                        </Text>
                                        <Text style={styles.productCode}>{product.product_code}</Text>
                                        <Text style={styles.productPrice}>₹{product.price}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="package-variant-closed" size={50} color="#ddd" />
                                <Text style={styles.emptyText}>No products in this category</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Sale Modal */}
            <Modal
                visible={showSaleModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSaleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Enter Sale Details</Text>
                            <TouchableOpacity onPress={() => setShowSaleModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

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

                                {/* Quantity Input */}
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

                                {/* Description */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Description (Optional)</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Add notes about this sale..."
                                        value={desc}
                                        onChangeText={setDesc}
                                        placeholderTextColor="#999"
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>

                                {/* Total Preview */}
                                <View style={styles.totalContainer}>
                                    <Text style={styles.totalLabel}>Total Amount</Text>
                                    <Text style={styles.totalValue}>
                                        ₹{(selectedProduct.price * (parseInt(qty) || 0)).toFixed(2)}
                                    </Text>
                                </View>

                                {/* Submit Button */}
                                <TouchableOpacity
                                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                                    onPress={handleSubmitSale}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
                                            <Text style={styles.submitButtonText}>Confirm Sale</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
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
    header: {
        paddingTop: Platform.OS === 'android' ? 20 : 20,
        paddingBottom: 15,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    menuButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    section: {
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 15,
    },
    clearText: {
        fontSize: 14,
        color: '#3a48c2',
        fontWeight: '600',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 10,
    },
    categoryCard: {
        width: (Dimensions.get('window').width - 40 - 20) / 3, // (screenWidth - padding - gaps) / 3 columns
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
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
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
    productGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    productCard: {
        width: '47%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    productName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    productCode: {
        fontSize: 11,
        color: '#888',
        marginBottom: 8,
    },
    productPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#15803d',
    },
    loadingProducts: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30,
        gap: 10,
    },
    loadingText: {
        color: '#666',
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
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
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
    submitButton: {
        backgroundColor: '#3a48c2',
        borderRadius: 12,
        padding: 16,
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
});

export default SalesScreen;
