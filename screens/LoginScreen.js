import React, { useState } from 'react';
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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../services';
import { permissionService } from '../services/permissionService';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const validateInput = () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return false;
        }
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return false;
        }
        return true;
    };

    const handleLogin = async () => {
        if (!validateInput()) return;

        setIsLoading(true);
        try {
            const response = await authService.login({
                email: email.trim(),
                password: password
            });

            if (response.success) {
                const { token, user } = response.data;
                await authService.saveAuthData(token, user);

                // Fetch and save user permissions
                try {
                    const permResponse = await permissionService.getMyPermissions();
                    if (permResponse && permResponse.data) {
                        // Backend returns permissions as a map: { 'Categories': { view: true, ... } }
                        const permsFromApi = permResponse.data.permissions || {};
                        // Convert keys to lowercase for consistent matching
                        const permMap = {};
                        Object.keys(permsFromApi).forEach(key => {
                            permMap[key.toLowerCase()] = permsFromApi[key];
                        });
                        await authService.savePermissions(permMap);
                    }
                } catch (permError) {
                    console.warn('Could not fetch permissions:', permError);
                    // If admin, grant all permissions by default
                    if (user.role === 'admin' || user.role_id === 1) {
                        await authService.savePermissions({
                            dashboard: { view: true, add: true, edit: true, del: true },
                            categories: { view: true, add: true, edit: true, del: true },
                            products: { view: true, add: true, edit: true, del: true },
                            sales: { view: true, add: true, edit: true, del: true },
                            reports: { view: true, add: true, edit: true, del: true },
                            users: { view: true, add: true, edit: true, del: true },
                            'roles & permissions': { view: true, add: true, edit: true, del: true }
                        });
                    }
                }

                // Reset form
                setEmail('');
                setPassword('');

                // Navigate to Home
                navigation.replace('Home');
            } else {
                Alert.alert('Login Failed', response.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login Error:', error);
            Alert.alert(
                'Error',
                error.message || 'Unable to connect to server. Please check your connection.'
            );
        } finally {
            setIsLoading(false);
        }
    };

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
                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="email-outline" size={24} color="#666" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#999"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                disabled={isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <MaterialCommunityIcons name="lock-outline" size={24} color="#666" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#999"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                disabled={isLoading}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                <MaterialCommunityIcons
                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                    size={24}
                                    color="#666"
                                />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.forgotPassword} disabled={isLoading}>
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.loginButtonText}>Login</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.signUpContainer}>
                            <Text style={styles.signUpText}>Don't have an account? </Text>
                            <TouchableOpacity disabled={isLoading}>
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
