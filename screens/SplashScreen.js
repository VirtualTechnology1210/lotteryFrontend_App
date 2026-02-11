import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    StatusBar,
    Easing,
    Dimensions,
    Platform
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { authService } from '../services';
import { permissionService } from '../services/permissionService';
import { reportService } from '../services/reportService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
    // Animation Values
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoScale = useRef(new Animated.Value(0.3)).current;
    const logoTranslateY = useRef(new Animated.Value(20)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const shimmerValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Sequential entrance animation
        Animated.sequence([
            // Logo pops up
            Animated.parallel([
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.back(1.5)),
                }),
                Animated.timing(logoScale, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.back(1.5)),
                }),
                Animated.timing(logoTranslateY, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.quad),
                }),
            ]),
            // Text fades in smoothly
            Animated.timing(textOpacity, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
                easing: Easing.inOut(Easing.quad),
            }),
        ]).start();

        // Shimmer effect loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerValue, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                    easing: Easing.linear,
                }),
                Animated.timing(shimmerValue, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        const checkSession = async () => {
            try {
                const startTime = Date.now();

                // Fetch auth data and validate session
                // We do this while the user is wowed by the animation
                const { token, user } = await authService.getAuthData();

                let targetRoute = 'Login';
                let navigationParams = {};

                if (token && user) {
                    try {
                        // Use allSettled so one failure doesn't kill the other
                        const [permResult, dashboardResult] = await Promise.allSettled([
                            permissionService.getMyPermissions(),
                            reportService.getSalesReport({ limit: 100 })
                        ]);

                        // Check for auth errors (401) in either result
                        const authFailed = [permResult, dashboardResult].some(r =>
                            r.status === 'rejected' &&
                            (r.reason?.response?.status === 401 || r.reason?.message?.includes('token'))
                        );

                        if (authFailed) {
                            console.warn('Splash: Auth failed, redirecting to login');
                            targetRoute = 'Login';
                        } else {
                            // Handle Permissions (even if dashboard failed)
                            if (permResult.status === 'fulfilled' && permResult.value?.data?.permissions) {
                                const permsFromApi = permResult.value.data.permissions;
                                const permMap = {};
                                Object.keys(permsFromApi).forEach(key => {
                                    permMap[key.toLowerCase()] = permsFromApi[key];
                                });
                                await AsyncStorage.setItem('userPermissions', JSON.stringify(permMap));
                                navigationParams.permissions = permMap;
                            }

                            // Handle Dashboard Data (only if it succeeded)
                            if (dashboardResult.status === 'fulfilled' && dashboardResult.value?.data) {
                                navigationParams.dashboardData = dashboardResult.value.data;
                            }

                            targetRoute = 'Home';
                        }
                    } catch (error) {
                        console.warn('Splash: Unexpected error', error);
                        targetRoute = 'Home';
                    }
                }

                const endTime = Date.now();
                const elapsedTime = endTime - startTime;
                const minDisplayTime = 2200; // Perfect duration for the animation feel
                const waitTime = Math.max(0, minDisplayTime - elapsedTime);

                setTimeout(() => {
                    // Smooth exit animation before navigation
                    Animated.parallel([
                        Animated.timing(logoOpacity, {
                            toValue: 0,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                        Animated.timing(logoScale, {
                            toValue: 1.2,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                        Animated.timing(textOpacity, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                        })
                    ]).start(() => {
                        navigation.replace(targetRoute, navigationParams);
                    });
                }, waitTime);

            } catch (error) {
                console.error('Splash Session Error:', error);
                navigation.replace('Login');
            }
        };

        checkSession();
    }, [navigation]);

    // Shimmer translateX interpolation
    const shimmerTranslateX = shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8F9FD" />

            <View style={styles.content}>
                {/* Minimalist Premium Logo Container */}
                <Animated.View style={[
                    styles.logoWrapper,
                    {
                        opacity: logoOpacity,
                        transform: [
                            { scale: logoScale },
                            { translateY: logoTranslateY }
                        ]
                    }
                ]}>
                    <View style={styles.logoCircle}>
                        <LinearGradient
                            colors={['#3a48c2', '#2a38a0']}
                            style={styles.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <MaterialCommunityIcons name="clover" size={80} color="#FFFFFF" />
                        </LinearGradient>

                        {/* Shimmer Overlay */}
                        <Animated.View style={[
                            styles.shimmerContainer,
                            { transform: [{ translateX: shimmerTranslateX }] }
                        ]}>
                            <LinearGradient
                                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                                style={styles.shimmer}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                        </Animated.View>
                    </View>
                </Animated.View>

                {/* Text Section */}
                <Animated.View style={{ opacity: textOpacity }}>
                    <Text style={styles.brandTitle}>Lottery System</Text>
                    <View style={styles.indicatorContainer}>
                        <View style={styles.dot} />
                        <View style={[styles.dot, styles.dotActive]} />
                        <View style={styles.dot} />
                    </View>
                </Animated.View>
            </View>

            {/* Subtle bottom detail */}
            <Animated.View style={[styles.footer, { opacity: textOpacity }]}>
                <Text style={styles.secureText}>
                    <MaterialCommunityIcons name="shield-check" size={14} color="#3a48c2" /> Secure Terminal
                </Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD', // Identical to Dashboard background for seamless transition
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoWrapper: {
        marginBottom: 30,
    },
    logoCircle: {
        width: 140,
        height: 140,
        borderRadius: 45, // Rounded square for a modern "App Icon" feel
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    gradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shimmerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    shimmer: {
        width: '100%',
        height: '100%',
    },
    brandTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#1a1a1a',
        letterSpacing: 1.5,
        textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'Roboto',
    },
    indicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 15,
        gap: 8,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D1D5DB',
    },
    dotActive: {
        width: 20,
        backgroundColor: '#3a48c2',
    },
    footer: {
        position: 'absolute',
        bottom: 60,
    },
    secureText: {
        fontSize: 13,
        color: '#3a48c2',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    }
});

export default SplashScreen;
