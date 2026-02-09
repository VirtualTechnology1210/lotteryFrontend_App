import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { authService } from '../services';

const CustomDrawer = (props) => {
    const [user, setUser] = useState({ name: '', email: '', role: '' });

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const { user } = await authService.getAuthData();
                if (user) {
                    setUser({
                        name: user.name,
                        email: user.email,
                        role: user.role
                    });
                }
            } catch (e) {
                console.log("Error loading user in drawer", e);
            }
        };
        fetchUser();
    }, []);

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await authService.logout();
                        props.navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <DrawerContentScrollView
                {...props}
                contentContainerStyle={styles.drawerContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Enhanced User Profile Header */}
                <LinearGradient
                    colors={['#3a48c2', '#2a38a0', '#192f6a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerBackground}
                >
                    {/* Decorative circles */}
                    <View style={styles.decorativeCircle1} />
                    <View style={styles.decorativeCircle2} />

                    <View style={styles.profileContainer}>
                        <View style={styles.avatarContainer}>
                            <Image
                                source={{
                                    uri: `https://ui-avatars.com/api/?name=${user.name.replace(' ', '+')}&background=ffffff&color=3a48c2&size=200&bold=true`
                                }}
                                style={styles.avatar}
                            />
                            <View style={[styles.statusDot, { backgroundColor: '#4ade80' }]} />
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                            {user.email && (
                                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                            )}
                        </View>
                    </View>
                </LinearGradient>

                {/* Navigation Items with enhanced styling */}
                <View style={styles.drawerList}>
                    <Text style={styles.sectionTitle}>MENU</Text>
                    <DrawerItemList {...props} />
                </View>

                {/* App Info Section */}
                <View style={styles.appInfoSection}>
                    <View style={styles.divider} />
                    <View style={styles.appInfoContainer}>
                        <MaterialCommunityIcons name="information-outline" size={16} color="#999" />
                        <Text style={styles.appInfoText}>Lottery Management v1.0</Text>
                    </View>
                </View>
            </DrawerContentScrollView>

            {/* Enhanced Footer Section */}
            <View style={styles.footer}>
                {/* Printer Settings Button */}
                <TouchableOpacity
                    style={styles.printerButton}
                    onPress={() => props.navigation.navigate('PrinterSettings')}
                    activeOpacity={0.7}
                >
                    <View style={styles.printerButtonInner}>
                        <MaterialCommunityIcons name="printer-settings" size={20} color="#3a48c2" />
                        <Text style={styles.printerButtonText}>Printer Settings</Text>
                        <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                >
                    <LinearGradient
                        colors={['#FF5252', '#E53935']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.logoutGradient}
                    >
                        <MaterialCommunityIcons name="logout-variant" size={22} color="#fff" />
                        <Text style={styles.logoutText}>Sign Out</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    drawerContent: {
        paddingTop: 0,
    },
    headerBackground: {
        padding: 24,
        paddingTop: 40,
        paddingBottom: 20,

        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 10,
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
    },
    decorativeCircle1: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        top: -50,
        right: -30,
    },
    decorativeCircle2: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        bottom: -20,
        left: -20,
    },
    profileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 1,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 75,
        height: 75,
        borderRadius: 38,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: '#fff',
    },
    statusDot: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        bottom: 2,
        right: 2,
        borderWidth: 3,
        borderColor: '#3a48c2',
    },
    userInfo: {
        marginLeft: 16,
        flex: 1,
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
        letterSpacing: 0.3,
    },
    userEmail: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginBottom: 8,
    },
    badgeContainer: {
        flexDirection: 'row',
        marginTop: 4,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
    },
    roleText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    drawerList: {
        flex: 1,
        paddingHorizontal: 12,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#999',
        letterSpacing: 1,
        marginLeft: 16,
        marginBottom: 8,
        marginTop: 4,
    },
    appInfoSection: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 12,
    },
    appInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    appInfoText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
    },
    footer: {
        padding: 16,
        paddingBottom: 20,
        backgroundColor: '#F8F9FD',
    },
    logoutButton: {
        borderRadius: 36,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#FF5252',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    logoutGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 10,
    },
    logoutText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    printerButton: {
        marginBottom: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        overflow: 'hidden',
    },
    printerButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    printerButtonText: {
        flex: 1,
        fontSize: 15,
        color: '#333',
        fontWeight: '600',
        marginLeft: 12,
    },
});

export default CustomDrawer;
