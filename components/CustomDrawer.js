import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { authService } from '../services';

const CustomDrawer = (props) => {
    const [user, setUser] = useState({ name: '', email: '' });

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const { user } = await authService.getAuthData();
                if (user) {
                    setUser({
                        name: user.name,
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
            >
                {/* User Profile Header */}
                <LinearGradient
                    colors={['#3a48c2ff', '#192f6a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerBackground}
                >
                    <View style={styles.profileContainer}>
                        <Image
                            source={{
                                uri: `https://ui-avatars.com/api/?name=${user.name.replace(' ', '+')}&background=random&color=fff&size=200`
                            }}
                            style={styles.avatar}
                        />
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{user.name}</Text>
                            <Text style={styles.userEmail}>{user.email}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Navigation Items */}
                <View style={styles.drawerList}>
                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView>

            {/* Footer Section */}
            <View style={styles.footer}>

                <TouchableOpacity style={styles.footerItem} onPress={handleLogout}>
                    <View style={styles.footerIconContainer}>
                        <MaterialCommunityIcons name="logout" size={24} color="#FF5252" />
                    </View>
                    <Text style={[styles.footerText, { color: '#FF5252' }]}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    drawerContent: {
        paddingTop: 0,
    },
    headerBackground: {
        padding: 20,
        paddingTop: 30, // More top padding for status bar area
        marginBottom: 10,
        borderBottomRightRadius: 30, // Stylish curve
    },
    profileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    userInfo: {
        marginLeft: 15,
        flex: 1,
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    userEmail: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 6,
    },
    badgeContainer: {
        flexDirection: 'row',
    },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    drawerList: {
        flex: 1,
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingBottom: 20,
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    footerIconContainer: {
        width: 30,
        alignItems: 'center',
        marginRight: 8,
    },
    footerText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
});

export default CustomDrawer;
