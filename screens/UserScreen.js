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
import { userService } from '../services/userService';

// Memoized User List Item
const UserListItem = memo(({ user, onEdit, onDelete }) => {
    const getRoleBadgeColor = (roleName) => {
        switch (roleName?.toLowerCase()) {
            case 'admin':
                return { bg: '#FEE2E2', text: '#991B1B' };
            case 'user':
                return { bg: '#DBEAFE', text: '#1E40AF' };
            default:
                return { bg: '#F5F7FA', text: '#555' };
        }
    };

    const roleColors = getRoleBadgeColor(user.role?.role);

    return (
        <View style={styles.userCard}>
            <View style={styles.userIconContainer}>
                <View style={styles.userIconCircle}>
                    <Text style={styles.userInitial}>{user.name.charAt(0).toUpperCase()}</Text>
                </View>
            </View>
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="email-outline" size={14} color="#666" />
                    <Text style={styles.emailText}>{user.email}</Text>
                </View>
                {user.role && (
                    <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                        <MaterialCommunityIcons
                            name={user.role.role === 'admin' ? 'shield-crown' : 'account'}
                            size={12}
                            color={roleColors.text}
                        />
                        <Text style={[styles.roleText, { color: roleColors.text }]}>
                            {user.role.role}
                        </Text>
                    </View>
                )}
            </View>
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onEdit(user)}
                >
                    <MaterialCommunityIcons name="pencil-outline" size={24} color="#3a48c2" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onDelete(user.id, user.name)}
                >
                    <MaterialCommunityIcons name="delete-outline" size={24} color="#FF5252" />
                </TouchableOpacity>
            </View>
        </View>
    );
});

const UserScreen = ({ navigation }) => {
    // ... code truncated for replacement context ...
    // Note: I will use the returned user variable for state handling
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [roleId, setRoleId] = useState(2); // Default to user role
    const [editingUser, setEditingUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocus, setIsFocus] = useState(false);

    // Role options
    const roles = [
        { label: 'Admin', value: 1 },
        { label: 'User', value: 2 }
    ];

    const fetchUsers = useCallback(async () => {
        try {
            const response = await userService.getAllUsers();
            if (response && response.data) {
                setUsers(response.data.users || []);
            }
        } catch (error) {
            console.error('Fetch users error:', error);
            Alert.alert('Error', 'Failed to load users');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchUsers();
    }, [fetchUsers]);

    const handleEdit = useCallback((user) => {
        setName(user.name);
        setEmail(user.email);
        setPassword(''); // Don't pre-fill password for security
        setRoleId(user.role_id);
        setEditingUser(user);
        setShowAddModal(true);
    }, []);

    const resetForm = () => {
        setName('');
        setEmail('');
        setPassword('');
        setRoleId(2);
        setEditingUser(null);
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
        if (!name.trim()) {
            Alert.alert('Validation Error', 'Please enter user name');
            return;
        }
        if (!email.trim()) {
            Alert.alert('Validation Error', 'Please enter email');
            return;
        }
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert('Validation Error', 'Please enter a valid email address');
            return;
        }
        if (!editingUser && !password.trim()) {
            Alert.alert('Validation Error', 'Please enter password');
            return;
        }
        if (password && password.length < 6) {
            Alert.alert('Validation Error', 'Password must be at least 6 characters');
            return;
        }

        setIsSubmitting(true);
        try {
            const userData = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                role_id: roleId
            };

            // Only include password if it's provided
            if (password.trim()) {
                userData.password = password;
            }

            if (editingUser) {
                await userService.updateUser(editingUser.id, userData);
                Alert.alert('Success', 'User updated successfully');
            } else {
                await userService.createUser(userData);
                Alert.alert('Success', 'User created successfully');
            }

            resetForm();
            setShowAddModal(false);
            fetchUsers();
        } catch (error) {
            console.error('Submit user error:', error);
            const msg = error.response?.data?.message || (editingUser ? 'Failed to update user' : 'Failed to create user');
            Alert.alert('Error', msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = useCallback((id, userName) => {
        Alert.alert(
            'Delete User',
            `Are you sure you want to delete "${userName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await userService.deleteUser(id);
                            Alert.alert('Success', 'User deleted successfully');
                            fetchUsers();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete user');
                        }
                    }
                }
            ]
        );
    }, [fetchUsers]);

    const getRoleBadgeColor = (roleName) => {
        switch (roleName?.toLowerCase()) {
            case 'admin':
                return { bg: '#FEE2E2', text: '#991B1B' };
            case 'user':
                return { bg: '#DBEAFE', text: '#1E40AF' };
            default:
                return { bg: '#F5F7FA', text: '#555' };
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
                    <Text style={styles.headerTitle}>Users</Text>
                    <TouchableOpacity
                        onPress={toggleModal}
                        style={styles.addButton}
                    >
                        <MaterialCommunityIcons
                            name={showAddModal ? "close" : "plus"}
                            size={26}
                            color="#fff"
                        />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3a48c2" />
                }
            >
                {/* Add User Form */}
                {showAddModal && (
                    <View style={styles.addFormContainer}>
                        <Text style={styles.formTitle}>{editingUser ? 'Edit User' : 'Create New User'}</Text>

                        {/* Name */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter user name"
                                value={name}
                                onChangeText={setName}
                                placeholderTextColor="#999"
                            />
                        </View>

                        {/* Email */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter email address"
                                value={email}
                                onChangeText={setEmail}
                                placeholderTextColor="#999"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Password */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password {editingUser ? '(Leave blank to keep current)' : '*'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={editingUser ? "Enter new password (optional)" : "Enter password (min 6 characters)"}
                                value={password}
                                onChangeText={setPassword}
                                placeholderTextColor="#999"
                                secureTextEntry
                            />
                        </View>

                        {/* Role Dropdown */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Role *</Text>
                            <Dropdown
                                style={[styles.dropdown, isFocus && { borderColor: '#3a48c2' }]}
                                placeholderStyle={styles.placeholderStyle}
                                selectedTextStyle={styles.selectedTextStyle}
                                data={roles}
                                maxHeight={300}
                                labelField="label"
                                valueField="value"
                                placeholder={!isFocus ? 'Select Role' : '...'}
                                value={roleId}
                                onFocus={() => setIsFocus(true)}
                                onBlur={() => setIsFocus(false)}
                                onChange={item => {
                                    setRoleId(item.value);
                                    setIsFocus(false);
                                }}
                            />
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>{editingUser ? 'Update User' : 'Create User'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Users List */}
                <View style={styles.usersContainer}>
                    <Text style={styles.sectionTitle}>All Users ({users.length})</Text>

                    {users.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="account-group-outline" size={60} color="#ddd" />
                            <Text style={styles.emptyText}>No users yet</Text>
                            <Text style={styles.emptySubtext}>Tap the + button to create one</Text>
                        </View>
                    ) : (
                        users.map((user) => (
                            <UserListItem
                                key={user.id}
                                user={user}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
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
    header: {
        paddingTop: Platform.OS === 'android' ? 20 : 20,
        paddingBottom: 10,
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
    addButton: {
        padding: 8,
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
    usersContainer: {
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
    userCard: {
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
    userIconContainer: {
        marginRight: 15,
    },
    userIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#EEF0FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInitial: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#3a48c2',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 6,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    emailText: {
        fontSize: 13,
        color: '#666',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    roleText: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'capitalize',
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 10,
    },
});

export default UserScreen;
