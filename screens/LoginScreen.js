import React, { useState, useCallback, useMemo, memo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    SafeAreaView,
    ActivityIndicator,
    Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../services';
import { permissionService } from '../services/permissionService';

// Memoized input component for better performance
const InputField = memo(({ icon, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, disabled, rightIcon }) => (
    <View style={styles.inputContainer}>
        <MaterialCommunityIcons name={icon} size={24} color="#666" style={styles.inputIcon} />
        <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            secureTextEntry={secureTextEntry}
            editable={!disabled}
            autoCorrect={false}
            spellCheck={false}
        />
        {rightIcon}
    </View>
));

// Default admin permissions for instant access
const DEFAULT_ADMIN_PERMISSIONS = {
    dashboard: { view: true, add: true, edit: true, del: true },
    categories: { view: true, add: true, edit: true, del: true },
    products: { view: true, add: true, edit: true, del: true },
    sales: { view: true, add: true, edit: true, del: true },
    reports: { view: true, add: true, edit: true, del: true },
    users: { view: true, add: true, edit: true, del: true },
    'roles & permissions': { view: true, add: true, edit: true, del: true }
};

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Memoized email validation regex
    const emailRegex = useMemo(() => /\S+@\S+\.\S+/, []);

    // Fast synchronous validation - no async operations
    const validateInput = useCallback(() => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return false;
        }
        if (!emailRegex.test(trimmedEmail)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return false;
        }
        return true;
    }, [email, password, emailRegex]);

    // Optimized login handler - fetches permissions BEFORE navigation
    const handleLogin = useCallback(async () => {
        if (!validateInput()) return;

        // Dismiss keyboard immediately for faster UI response
        Keyboard.dismiss();
        setIsLoading(true);

        const trimmedEmail = email.trim();

        try {
            const response = await authService.login({
                email: trimmedEmail,
                password: password
            });

            if (response.success) {
                const { token, user } = response.data;
                const isAdmin = user.role === 'admin' || user.role_id === 1;

                // Save token and user first
                await AsyncStorage.multiSet([
                    ['userToken', token],
                    ['userProfile', JSON.stringify(user)]
                ]);

                // For admin: set default admin permissions immediately
                // For non-admin: MUST fetch permissions BEFORE navigation
                if (isAdmin) {
                    await AsyncStorage.setItem('userPermissions', JSON.stringify(DEFAULT_ADMIN_PERMISSIONS));
                } else {
                    // Critical: Fetch and save permissions BEFORE navigating
                    // This prevents the race condition where drawer renders with empty permissions
                    try {
                        const permResponse = await permissionService.getMyPermissions();
                        if (permResponse?.data?.permissions) {
                            const permsFromApi = permResponse.data.permissions;
                            const permMap = {};
                            Object.keys(permsFromApi).forEach(key => {
                                // Normalize to lowercase for consistent matching
                                permMap[key.toLowerCase()] = permsFromApi[key];
                            });
                            await AsyncStorage.setItem('userPermissions', JSON.stringify(permMap));
                        } else {
                            // No permissions returned - save empty object
                            await AsyncStorage.setItem('userPermissions', JSON.stringify({}));
                        }
                    } catch (permError) {
                        console.warn('Could not fetch permissions:', permError);
                        // Save empty permissions to avoid undefined issues
                        await AsyncStorage.setItem('userPermissions', JSON.stringify({}));
                    }
                }

                // Reset form
                setEmail('');
                setPassword('');
                setIsLoading(false);

                // Navigate AFTER permissions are saved
                navigation.replace('Home');
            } else {
                setIsLoading(false);
                Alert.alert('Login Failed', response.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login Error:', error);
            setIsLoading(false);
            Alert.alert(
                'Error',
                error.message || 'Unable to connect to server. Please check your connection.'
            );
        }
    }, [email, password, navigation, validateInput]);

    // Memoized toggle handler
    const toggleShowPassword = useCallback(() => {
        setShowPassword(prev => !prev);
    }, []);

    // Memoized password icon
    const passwordIcon = useMemo(() => (
        <TouchableOpacity onPress={toggleShowPassword} style={styles.eyeIcon} activeOpacity={0.7}>
            <MaterialCommunityIcons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={24}
                color="#666"
            />
        </TouchableOpacity>
    ), [showPassword, toggleShowPassword]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    style={styles.content}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.headerContainer}>
                        <View style={styles.logoPlaceholder}>
                            <MaterialCommunityIcons name="finance" size={60} color="#2510C4" />
                        </View>
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to continue to Lottery</Text>
                    </View>

                    <View style={styles.formContainer}>
                        {/* Email Input - Memoized for performance */}
                        <InputField
                            icon="email-outline"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Email Address"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            disabled={isLoading}
                        />

                        {/* Password Input with toggle */}
                        <InputField
                            icon="lock-outline"
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Password"
                            secureTextEntry={!showPassword}
                            disabled={isLoading}
                            rightIcon={passwordIcon}
                        />

                        <TouchableOpacity
                            style={styles.forgotPassword}
                            disabled={isLoading}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading}
                            activeOpacity={0.8}
                            delayPressIn={0}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={styles.loginButtonText}>Login</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.signUpContainer}>
                            <Text style={styles.signUpText}>Don't have an account? </Text>
                            <TouchableOpacity disabled={isLoading} activeOpacity={0.7}>
                                <Text style={styles.signUpLink}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        justifyContent: 'center',
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 50,
    },
    logoPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 30,
        backgroundColor: '#EEECFC', // Lighter shade of the primary color
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
    },
    formContainer: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7F7F7',
        borderRadius: 15,
        marginBottom: 20,
        paddingHorizontal: 15,
        height: 60,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#333',
        fontSize: 16,
    },
    eyeIcon: {
        padding: 10,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 30,
    },
    forgotPasswordText: {
        color: '#2510C4',
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: '#2510C4',
        borderRadius: 15,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#2510C4',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    loginButtonDisabled: {
        backgroundColor: '#8E82E3',
        shadowOpacity: 0.1,
        elevation: 1,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    signUpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 30,
    },
    signUpText: {
        color: '#666',
        fontSize: 15,
    },
    signUpLink: {
        color: '#2510C4',
        fontWeight: 'bold',
        fontSize: 15,
    },
});

export default LoginScreen;
