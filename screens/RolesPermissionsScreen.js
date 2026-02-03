import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    RefreshControl
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Dropdown } from 'react-native-element-dropdown';
import { permissionService, pageService, roleService } from '../services/permissionService';

// Memoized Checkbox for instant toggle response
const PermissionCheckbox = memo(({ isChecked, onToggle }) => (
    <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={onToggle}
    >
        <View style={[
            styles.checkbox,
            isChecked && styles.checkboxChecked
        ]}>
            {isChecked && (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
            )}
        </View>
    </TouchableOpacity>
));

// Memoized Permission Row for faster list rendering
const PermissionRow = memo(({ page, permissions, onToggle }) => (
    <View style={styles.tableRow}>
        <Text style={[styles.pageName, styles.pageColumn]}>{page.page}</Text>
        <PermissionCheckbox
            isChecked={permissions?.view || false}
            onToggle={() => onToggle(page.id, 'view')}
        />
        <PermissionCheckbox
            isChecked={permissions?.add || false}
            onToggle={() => onToggle(page.id, 'add')}
        />
        <PermissionCheckbox
            isChecked={permissions?.edit || false}
            onToggle={() => onToggle(page.id, 'edit')}
        />
        <PermissionCheckbox
            isChecked={permissions?.del || false}
            onToggle={() => onToggle(page.id, 'del')}
        />
    </View>
));

const RolesPermissionsScreen = ({ navigation }) => {
    const [roles, setRoles] = useState([]);
    const [pages, setPages] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isFocus, setIsFocus] = useState(false);

    // Permission state for selected role
    const [rolePermissions, setRolePermissions] = useState({});

    const fetchData = useCallback(async () => {
        try {
            const [rolesRes, pagesRes] = await Promise.all([
                roleService.getAllRoles(),
                pageService.getAllPages()
            ]);

            if (rolesRes && rolesRes.data) {
                const rolesList = (rolesRes.data.roles || []).map(role => ({
                    label: role.role,
                    value: role.id
                }));
                setRoles(rolesList);

                // Auto-select first role if available
                if (rolesList.length > 0 && !selectedRoleId) {
                    setSelectedRoleId(rolesList[0].value);
                }
            }

            if (pagesRes && pagesRes.data) {
                setPages(pagesRes.data.pages || []);
            }
        } catch (error) {
            console.error('Fetch data error:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [selectedRoleId]);

    const fetchPermissionsForRole = useCallback(async (roleId) => {
        if (!roleId) return;

        try {
            const response = await permissionService.getPermissionsByRole(roleId);
            if (response && response.data) {
                const perms = response.data.permissions || [];

                // Convert to a map for easy access
                const permMap = {};
                perms.forEach(perm => {
                    permMap[perm.page_id] = {
                        id: perm.id,
                        view: perm.view === 1,
                        add: perm.add === 1,
                        edit: perm.edit === 1,
                        del: perm.del === 1
                    };
                });

                setRolePermissions(permMap);
            }
        } catch (error) {
            console.error('Fetch permissions error:', error);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (selectedRoleId) {
            fetchPermissionsForRole(selectedRoleId);
        }
    }, [selectedRoleId, fetchPermissionsForRole]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
        if (selectedRoleId) {
            fetchPermissionsForRole(selectedRoleId);
        }
    }, [fetchData, selectedRoleId, fetchPermissionsForRole]);

    // Memoized toggle handler for instant responsiveness
    const handlePermissionToggle = useCallback((pageId, permissionType) => {
        setRolePermissions(prev => ({
            ...prev,
            [pageId]: {
                ...prev[pageId],
                [permissionType]: !prev[pageId]?.[permissionType]
            }
        }));
    }, []);

    const handleSavePermissions = async () => {
        if (!selectedRoleId) {
            Alert.alert('Error', 'Please select a role');
            return;
        }

        setIsSaving(true);
        try {
            // Convert permissions map to array format for bulk update
            const permissionsArray = pages.map(page => ({
                page_id: page.id,
                view: rolePermissions[page.id]?.view || false,
                add: rolePermissions[page.id]?.add || false,
                edit: rolePermissions[page.id]?.edit || false,
                del: rolePermissions[page.id]?.del || false
            }));

            await permissionService.bulkUpdatePermissions({
                role_id: selectedRoleId,
                permissions: permissionsArray
            });

            Alert.alert('Success', 'Permissions updated successfully');
            fetchPermissionsForRole(selectedRoleId);
        } catch (error) {
            console.error('Save permissions error:', error);
            Alert.alert('Error', 'Failed to save permissions');
        } finally {
            setIsSaving(false);
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
                    <Text style={styles.headerTitle}>Roles & Permissions</Text>
                    <View style={styles.menuButton} />
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3a48c2" />
                }
            >
                {/* Role Selector */}
                <View style={styles.selectorContainer}>
                    <Text style={styles.selectorLabel}>Select Role</Text>
                    <Dropdown
                        style={[styles.dropdown, isFocus && { borderColor: '#3a48c2' }]}
                        placeholderStyle={styles.placeholderStyle}
                        selectedTextStyle={styles.selectedTextStyle}
                        data={roles}
                        maxHeight={300}
                        labelField="label"
                        valueField="value"
                        placeholder={!isFocus ? 'Select Role' : '...'}
                        value={selectedRoleId}
                        onFocus={() => setIsFocus(true)}
                        onBlur={() => setIsFocus(false)}
                        onChange={item => {
                            setSelectedRoleId(item.value);
                            setIsFocus(false);
                        }}
                    />
                </View>

                {/* Permissions Table */}
                {selectedRoleId && (
                    <View style={styles.permissionsContainer}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, styles.pageColumn]}>Page</Text>
                            <Text style={styles.tableHeaderText}>View</Text>
                            <Text style={styles.tableHeaderText}>Add</Text>
                            <Text style={styles.tableHeaderText}>Edit</Text>
                            <Text style={styles.tableHeaderText}>Delete</Text>
                        </View>

                        {pages.map((page) => (
                            <PermissionRow
                                key={page.id}
                                page={page}
                                permissions={rolePermissions[page.id]}
                                onToggle={handlePermissionToggle}
                            />
                        ))}

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                            onPress={handleSavePermissions}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                                    <Text style={styles.saveButtonText}>Save Permissions</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {!selectedRoleId && (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="shield-account-outline" size={60} color="#ddd" />
                        <Text style={styles.emptyText}>Select a role to manage permissions</Text>
                    </View>
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
    scrollView: {
        flex: 1,
    },
    selectorContainer: {
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
    selectorLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
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
    permissionsContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 20,
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: '#3a48c2',
        marginBottom: 10,
    },
    tableHeaderText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#3a48c2',
        flex: 1,
        textAlign: 'center',
    },
    pageColumn: {
        flex: 2,
        textAlign: 'left',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    pageName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    checkboxContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D0D0D0',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#3a48c2',
        borderColor: '#3a48c2',
    },
    saveButton: {
        backgroundColor: '#3a48c2',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#999',
        marginTop: 15,
    },
});

export default RolesPermissionsScreen;
