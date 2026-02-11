import React, { useState, useEffect, useCallback, memo } from 'react';
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
    RefreshControl
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Dropdown } from 'react-native-element-dropdown';
import { productService } from '../services/productService';
import { categoryService } from '../services/categoryService';
import { authService } from '../services';

// Memoized Product List Item for better performance
const ProductListItem = memo(({ product, onEdit, onDelete, canEdit, canDelete }) => (
    <View style={styles.productCard}>
        <View style={styles.productIconContainer}>
            <View style={styles.productIconCircle}>
                <Text style={styles.productInitial}>{product.product_name.charAt(0).toUpperCase()}</Text>
            </View>
        </View>
        <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.product_name}</Text>
            <View style={styles.metaRow}>
                <View style={[styles.badge, styles.priceBadge]}>
                    <Text style={styles.priceText}>₹{product.price}</Text>
                </View>
                {product.box === 1 && (
                    <View style={[styles.badge, styles.boxBadge]}>
                        <MaterialCommunityIcons name="package-variant-closed" size={12} color="#854d0e" />
                        <Text style={styles.boxText}>Box</Text>
                    </View>
                )}
            </View>
            {product.category_name && (
                <Text style={styles.categoryLabel}>{product.category_name}</Text>
            )}
        </View>
        {(canEdit || canDelete) && (
            <View style={styles.actionsContainer}>
                {canEdit && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onEdit(product)}
                    >
                        <MaterialCommunityIcons name="pencil-outline" size={24} color="#3a48c2" />
                    </TouchableOpacity>
                )}
                {canDelete && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onDelete(product.id, product.product_name)}
                    >
                        <MaterialCommunityIcons name="delete-outline" size={24} color="#FF5252" />
                    </TouchableOpacity>
                )}
            </View>
        )}
    </View>
));

const ProductScreen = ({ navigation }) => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Permission state
    const [permissions, setPermissions] = useState({
        view: false,
        add: false,
        edit: false,
        del: false
    });

    // Form state
    const [categoryId, setCategoryId] = useState(null);
    const [productName, setProductName] = useState('');
    const [productCode, setProductCode] = useState('');
    const [price, setPrice] = useState('');
    const [box, setBox] = useState(0); // 0 = No, 1 = Yes
    const [editingProduct, setEditingProduct] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocus, setIsFocus] = useState(false);

    // Load permissions on mount
    useEffect(() => {
        const loadPermissions = async () => {
            try {
                const perms = await authService.getPermissions();
                const productPerms = perms['products'] || {};
                setPermissions({
                    view: productPerms.view || false,
                    add: productPerms.add || false,
                    edit: productPerms.edit || false,
                    del: productPerms.del || false
                });
            } catch (error) {
                console.error('Error loading permissions:', error);
            }
        };
        loadPermissions();
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [productsRes, categoriesRes] = await Promise.all([
                productService.getAllProducts(),
                categoryService.getActiveCategories()
            ]);

            if (productsRes && productsRes.data) {
                setProducts(productsRes.data.products || []);
            }
            if (categoriesRes && categoriesRes.data) {
                // Map categories for dropdown
                const cats = (categoriesRes.data.categories || []).map(cat => ({
                    label: cat.category_name,
                    value: cat.id
                }));
                setCategories(cats);
            }
        } catch (error) {
            console.error('Fetch data error:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    const handleEdit = useCallback((product) => {
        setCategoryId(product.category_id);
        setProductName(product.product_name);
        setProductCode(product.product_code);
        setPrice(product.price.toString());
        setBox(product.box || 0);
        setEditingProduct(product);
        setShowAddModal(true);
    }, []);

    const resetForm = () => {
        setCategoryId(null);
        setProductName('');
        setProductCode('');
        setPrice('');
        setBox(0);
        setEditingProduct(null);
    };

    const toggleModal = () => {
        if (showAddModal) {
            resetForm();
            setShowAddModal(false);
        } else {
            resetForm();
            setShowAddModal(true);
        }
    };

    const handleSubmit = async () => {
        if (!categoryId) {
            Alert.alert('Validation Error', 'Please select a category');
            return;
        }
        if (!productName.trim()) {
            Alert.alert('Validation Error', 'Please enter product name');
            return;
        }
        if (!productCode.trim()) {
            Alert.alert('Validation Error', 'Please enter product code');
            return;
        }
        if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            Alert.alert('Validation Error', 'Please enter a valid price');
            return;
        }

        setIsSubmitting(true);
        try {
            const productData = {
                category_id: categoryId,
                product_name: productName.trim(),
                product_code: productCode.trim(),
                price: parseFloat(price),
                box: box
            };

            if (editingProduct) {
                await productService.updateProduct(editingProduct.id, productData);
                Alert.alert('Success', 'Product updated successfully');
            } else {
                await productService.createProduct(productData);
                Alert.alert('Success', 'Product created successfully');
            }

            resetForm();
            setShowAddModal(false);
            fetchData();
        } catch (error) {
            console.error('Submit product error:', error);
            const msg = error.response?.data?.message || (editingProduct ? 'Failed to update product' : 'Failed to create product');
            Alert.alert('Error', msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = useCallback((id, name) => {
        Alert.alert(
            'Delete Product',
            `Are you sure you want to delete "${name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await productService.deleteProduct(id);
                            Alert.alert('Success', 'Product deleted successfully');
                            fetchData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete product');
                        }
                    }
                }
            ]
        );
    }, [fetchData]);

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
                    <Text style={styles.headerTitle}>Products</Text>
                    {permissions.add ? (
                        <TouchableOpacity
                            onPress={toggleModal}
                            style={styles.addButton}
                        >
                            <MaterialCommunityIcons
                                name={showAddModal ? "close" : "plus"}
                                size={28}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.addButtonPlaceholder} />
                    )}
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3a48c2" />
                }
            >
                {/* Add Product Form */}
                {showAddModal && (
                    <View style={styles.addFormContainer}>
                        <Text style={styles.formTitle}>{editingProduct ? 'Edit Product' : 'Create New Product'}</Text>

                        {/* Category Dropdown */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Category *</Text>
                            <Dropdown
                                style={[styles.dropdown, isFocus && { borderColor: '#3a48c2' }]}
                                placeholderStyle={styles.placeholderStyle}
                                selectedTextStyle={styles.selectedTextStyle}
                                data={categories}
                                maxHeight={300}
                                labelField="label"
                                valueField="value"
                                placeholder={!isFocus ? 'Select Category' : '...'}
                                value={categoryId}
                                onFocus={() => setIsFocus(true)}
                                onBlur={() => setIsFocus(false)}
                                onChange={item => {
                                    setCategoryId(item.value);
                                    setIsFocus(false);
                                }}
                            />
                        </View>

                        {/* Product Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Product Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter product name"
                                value={productName}
                                onChangeText={setProductName}
                                placeholderTextColor="#999"
                            />
                        </View>

                        {/* Product Code */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Product Code *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter product code (e.g., P001)"
                                value={productCode}
                                onChangeText={setProductCode}
                                placeholderTextColor="#999"
                                autoCapitalize="characters"
                            />
                        </View>

                        {/* Price */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Price *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter price"
                                value={price}
                                onChangeText={setPrice}
                                placeholderTextColor="#999"
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Box Selection (Yes/No) */}
                        <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setBox(box === 1 ? 0 : 1)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, box === 1 && styles.checkboxSelected]}>
                                {box === 1 && <MaterialCommunityIcons name="check" size={18} color="#fff" />}
                            </View>
                            <Text style={styles.checkboxLabel}>Box? </Text>
                        </TouchableOpacity>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>{editingProduct ? 'Update Product' : 'Create Product'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Products List */}
                <View style={styles.productsContainer}>
                    <Text style={styles.sectionTitle}>All Products ({products.length})</Text>

                    {products.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="package-variant" size={60} color="#ddd" />
                            <Text style={styles.emptyText}>No products yet</Text>
                            <Text style={styles.emptySubtext}>Tap the + button to create one</Text>
                        </View>
                    ) : (
                        products.map((product) => (
                            <ProductListItem
                                key={product.id}
                                product={product}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                canEdit={permissions.edit}
                                canDelete={permissions.del}
                            />
                        ))
                    )}
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
    addButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        padding: 8,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    addButtonPlaceholder: {
        width: 44,
        height: 44,
    },
    scrollView: {
        flex: 1,
    },
    addFormContainer: {
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
    formTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 20,
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
    dropdown: {
        height: 50,
        borderColor: '#E0E0E0',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        backgroundColor: '#F5F7FA',
    },
    placeholderStyle: {
        fontSize: 15,
        color: '#999',
    },
    selectedTextStyle: {
        fontSize: 15,
        color: '#1a1a1a',
    },
    submitButton: {
        backgroundColor: '#3a48c2',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
        backgroundColor: '#F5F7FA',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#3a48c2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        backgroundColor: '#fff',
    },
    checkboxSelected: {
        backgroundColor: '#3a48c2',
        borderColor: '#3a48c2',
    },
    checkboxLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    productsContainer: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 15,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#999',
        marginTop: 15,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#bbb',
        marginTop: 5,
    },
    productCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 15,
        padding: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    productIconContainer: {
        marginRight: 15,
    },
    productIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#EEF0FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    productInitial: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#3a48c2',
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 6,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    badgeText: {
        fontSize: 12,
        color: '#555',
        fontWeight: '600',
    },
    priceBadge: {
        backgroundColor: '#DCFCE7',
    },
    priceText: {
        fontSize: 12,
        color: '#15803d',
        fontWeight: 'bold',
    },
    boxBadge: {
        backgroundColor: '#FEF9C3',
    },
    boxText: {
        fontSize: 12,
        color: '#854d0e',
        fontWeight: 'bold',
    },
    categoryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#000000ff',
        marginTop: 2,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 10,
    },
});

export default ProductScreen;
