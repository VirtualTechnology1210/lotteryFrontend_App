import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    ActivityIndicator,
    Platform,
    RefreshControl
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { categoryService } from '../services/categoryService';
import { getImageUrl, authService } from '../services';

// Memoized Category List Item for better performance
const CategoryListItem = memo(({ category, onEdit, onDelete, canEdit, canDelete }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    const imageUrl = category.category_image ? getImageUrl(category.category_image) : null;
    const showImage = imageUrl && !imageError;

    return (
        <View style={styles.categoryCard}>
            {showImage && (
                <View style={styles.categoryImageContainer}>
                    {imageLoading && (
                        <View style={styles.categoryImagePlaceholder}>
                            <ActivityIndicator size="small" color="#3a48c2" />
                        </View>
                    )}
                    <Image
                        source={{ uri: imageUrl, cache: 'force-cache' }}
                        style={[styles.categoryImage, imageLoading && styles.imageHidden]}
                        onLoadEnd={() => setImageLoading(false)}
                        onError={() => {
                            setImageError(true);
                            setImageLoading(false);
                        }}
                    />
                </View>
            )}
            <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{category.category_name}</Text>
                {category.time_slots && category.time_slots.length > 0 && (
                    <View style={styles.categoryTimeSlots}>
                        {category.time_slots.map((slot, idx) => (
                            <View key={idx} style={styles.categoryTimeChip}>
                                <MaterialCommunityIcons name="clock-outline" size={12} color="#666" />
                                <Text style={styles.categoryTimeText}>{slot}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
            {(canEdit || canDelete) && (
                <View style={styles.actionsContainer}>
                    {canEdit && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => onEdit(category)}
                        >
                            <MaterialCommunityIcons name="pencil-outline" size={24} color="#3a48c2" />
                        </TouchableOpacity>
                    )}
                    {canDelete && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => onDelete(category.id, category.category_name)}
                        >
                            <MaterialCommunityIcons name="delete-outline" size={24} color="#FF5252" />
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
});

const CategoryScreen = ({ navigation }) => {
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
    const [categoryName, setCategoryName] = useState('');
    const [categoryImage, setCategoryImage] = useState(null);
    const [timeSlots, setTimeSlots] = useState([]);
    const [newTimeSlot, setNewTimeSlot] = useState('');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [selectedTime, setSelectedTime] = useState(new Date());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load permissions on mount
    useEffect(() => {
        const loadPermissions = async () => {
            try {
                const perms = await authService.getPermissions();
                const categoryPerms = perms['categories'] || {};
                setPermissions({
                    view: categoryPerms.view || false,
                    add: categoryPerms.add || false,
                    edit: categoryPerms.edit || false,
                    del: categoryPerms.del || false
                });
            } catch (error) {
                console.error('Error loading permissions:', error);
            }
        };
        loadPermissions();
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await categoryService.getAllCategories();
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

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchCategories();
    }, [fetchCategories]);

    const pickImage = () => {
        const options = {
            mediaType: 'photo',
            quality: 0.8,
            maxWidth: 1024,
            maxHeight: 1024,
        };

        launchImageLibrary(options, (response) => {
            if (response.didCancel) {
                console.log('User cancelled image picker');
            } else if (response.errorCode) {
                Alert.alert('Error', response.errorMessage || 'Failed to pick image');
            } else if (response.assets && response.assets[0]) {
                setCategoryImage(response.assets[0]);
            }
        });
    };

    const onTimeChange = (event, selectedDate) => {
        setShowTimePicker(Platform.OS === 'ios'); // Keep open on iOS
        if (selectedDate && event.type === 'set') {
            let hours = selectedDate.getHours();
            const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            const timeString = `${hours}:${minutes} ${ampm}`;

            // Set the single time slot
            setTimeSlots([timeString]);
        }
    };

    const showTimePickerDialog = () => {
        setSelectedTime(new Date());
        setShowTimePicker(true);
    };

    const removeTimeSlot = (index) => {
        setTimeSlots(timeSlots.filter((_, i) => i !== index));
    };

    const [editingCategory, setEditingCategory] = useState(null);

    const handleEdit = useCallback((category) => {
        setCategoryName(category.category_name);
        setTimeSlots(category.time_slots || []);

        // Set existing image if available
        if (category.category_image) {
            setCategoryImage({ uri: getImageUrl(category.category_image), isRemote: true });
        } else {
            setCategoryImage(null);
        }

        setEditingCategory(category);
        setShowAddModal(true);
    }, []);

    const handleSubmit = async () => {
        if (!categoryName.trim()) {
            Alert.alert('Validation Error', 'Please enter category name');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('category_name', categoryName.trim());
            formData.append('time_slots', JSON.stringify(timeSlots));
            formData.append('status', 1);

            // Only append image if it's a NEW image (not remote)
            // If categoryImage is null, no image is appended.
            // If categoryImage has isRemote: true, it means it's an existing image and we don't re-upload it.
            if (categoryImage && !categoryImage.isRemote) {
                formData.append('category_image', {
                    uri: categoryImage.uri,
                    type: categoryImage.type || 'image/jpeg',
                    name: categoryImage.fileName || `category_${Date.now()}.jpg`,
                });
            } else if (!categoryImage && editingCategory) {
                // If editing and image was removed, send a flag to clear it on backend
                formData.append('clear_image', 'true');
            }


            if (editingCategory) {
                await categoryService.updateCategory(editingCategory.id, formData);
                Alert.alert('Success', 'Category updated successfully');
            } else {
                await categoryService.createCategory(formData);
                Alert.alert('Success', 'Category created successfully');
            }

            // Reset form
            setCategoryName('');
            setCategoryImage(null);
            setTimeSlots([]);
            setEditingCategory(null);
            setShowAddModal(false);

            // Refresh list
            fetchCategories();
        } catch (error) {
            console.error('Submit category error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to save category');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = useCallback((id, name) => {
        Alert.alert(
            'Delete Category',
            `Are you sure you want to delete "${name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await categoryService.deleteCategory(id);
                            Alert.alert('Success', 'Category deleted successfully');
                            fetchCategories();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete category');
                        }
                    }
                }
            ]
        );
    }, [fetchCategories]);

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
                    <Text style={styles.headerTitle}>Categories</Text>
                    {permissions.add ? (
                        <TouchableOpacity
                            onPress={() => {
                                if (showAddModal) {
                                    setShowAddModal(false);
                                    setEditingCategory(null);
                                    setCategoryName('');
                                    setTimeSlots([]);
                                    setCategoryImage(null);
                                } else {
                                    setEditingCategory(null);
                                    setCategoryName('');
                                    setTimeSlots([]);
                                    setCategoryImage(null);
                                    setShowAddModal(true);
                                }
                            }}
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
                {/* Add Category Form */}
                {showAddModal && (
                    <View style={styles.addFormContainer}>
                        <Text style={styles.formTitle}>{editingCategory ? 'Edit Category' : 'Create New Category'}</Text>

                        {/* Category Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Category Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter category name"
                                value={categoryName}
                                onChangeText={setCategoryName}
                                placeholderTextColor="#999"
                            />
                        </View>

                        {/* Category Image */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Category Image</Text>
                            {categoryImage ? (
                                <View style={styles.previewContainer}>
                                    <Image source={{ uri: categoryImage.uri }} style={styles.imagePreview} />
                                    <TouchableOpacity
                                        style={styles.changeImageButton}
                                        onPress={pickImage}
                                    >
                                        <Text style={styles.changeImageText}>Change Image</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.removeImageButton}
                                        onPress={() => setCategoryImage(null)}
                                    >
                                        <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                                    <View style={styles.imagePlaceholder}>
                                        <MaterialCommunityIcons name="image-plus" size={40} color="#999" />
                                        <Text style={styles.imagePlaceholderText}>Tap to select image</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Time Slots */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Time Slot</Text>
                            {timeSlots.length === 0 && (
                                <TouchableOpacity
                                    style={styles.timePickerButton}
                                    onPress={showTimePickerDialog}
                                >
                                    <MaterialCommunityIcons name="clock-plus-outline" size={24} color="#3a48c2" />
                                    <Text style={styles.timePickerButtonText}>Add Time Slot</Text>
                                </TouchableOpacity>
                            )}

                            {timeSlots.length > 0 && (
                                <View style={styles.timeSlotsContainer}>
                                    {timeSlots.map((slot, index) => (
                                        <View key={index} style={styles.timeSlotChip}>
                                            <MaterialCommunityIcons name="clock-outline" size={16} color="#3a48c2" />
                                            <Text style={styles.timeSlotText}>{slot}</Text>
                                            <TouchableOpacity onPress={() => removeTimeSlot(index)}>
                                                <MaterialCommunityIcons name="close-circle" size={18} color="#FF5252" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Time Picker Modal */}
                        {showTimePicker && (
                            <DateTimePicker
                                value={selectedTime}
                                mode="time"
                                is24Hour={false}
                                display="default"
                                onChange={onTimeChange}
                            />
                        )}

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>{editingCategory ? 'Update Category' : 'Create Category'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Categories List */}
                <View style={styles.categoriesContainer}>
                    <Text style={styles.sectionTitle}>All Categories ({categories.length})</Text>

                    {categories.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="folder-outline" size={60} color="#ddd" />
                            <Text style={styles.emptyText}>No categories yet</Text>
                            <Text style={styles.emptySubtext}>Tap the + button to create one</Text>
                        </View>
                    ) : (
                        categories.map((category) => (
                            <CategoryListItem
                                key={category.id}
                                category={category}
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
        marginTop: -20, // Negative margin to pull up content slightly if needed, or keeping it clean
    },
    addFormContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginTop: 20, // Push down from overlap
        marginBottom: 20,
        padding: 20,
        borderRadius: 24,
        elevation: 8,
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
    imagePickerButton: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#E0E0E0',
        borderStyle: 'dashed',
    },
    imagePreview: {
        width: '100%',
        height: 200,
        resizeMode: 'cover',
        borderRadius: 12,
    },
    previewContainer: {
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
    },
    changeImageButton: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    changeImageText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    removeImageButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(255, 82, 82, 0.9)',
        padding: 8,
        borderRadius: 20,
    },
    imagePlaceholder: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
    },
    imagePlaceholderText: {
        marginTop: 10,
        color: '#999',
        fontSize: 14,
    },
    timeSlotInputContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    addTimeButton: {
        backgroundColor: '#3a48c2',
        borderRadius: 12,
        width: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F7FA',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        gap: 10,
    },
    timePickerButtonText: {
        fontSize: 15,
        color: '#3a48c2',
        fontWeight: '600',
    },
    timeSlotsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    timeSlotChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF0FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    timeSlotText: {
        fontSize: 14,
        color: '#3a48c2',
        fontWeight: '600',
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
    categoriesContainer: {
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
    categoryCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12, // Added padding for better layout with circular image
    },
    categoryImageContainer: {
        width: 60, // Slightly reduced size for better fit
        height: 60,
        backgroundColor: '#F0F0F0',
        borderRadius: 30, // Half of 60 for circle
        overflow: 'hidden',
    },
    categoryImage: {
        width: 60,
        height: 60,
        resizeMode: 'cover',
        borderRadius: 30,
    },
    categoryImagePlaceholder: {
        position: 'absolute',
        width: 60,
        height: 60,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 30,
    },
    imageHidden: {
        opacity: 0,
    },
    categoryInfo: {
        flex: 1,
        padding: 15,
    },
    categoryName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    categoryTimeSlots: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    categoryTimeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    categoryTimeText: {
        fontSize: 12,
        color: '#666',
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 10,
    },
});

export default CategoryScreen;
