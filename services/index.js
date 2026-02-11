import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base config
// Use 10.0.2.2 for Emulator, or your local machine IP (192.168.1.10) for Physical Device
export const SERVER_URL = 'http://192.168.1.10:5000';
export const BASE_URL = `${SERVER_URL}/api`;

// Helper to get full image URL
export const getImageUrl = (path) => {
    if (!path) return null;
    // If already a full URL, return as is
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    // Prepend server URL to relative path
    return `${SERVER_URL}${path}`;
};

// Create axios instance with optimized timeout
const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000, // Increased to 10s for better reliability on slower connections
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add token
apiClient.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        // Handle 401 Unauthorized errors (expired or invalid token)
        if (error.response?.status === 401) {
            console.warn('Unauthorized access detected (401). Clearing session...');
            try {
                // Clear storage to force re-login on next app start or session check
                await AsyncStorage.multiRemove(['userToken', 'userProfile', 'userPermissions']);
            } catch (e) {
                console.error('Error clearing storage on 401:', e);
            }
        }
        const message = error.response?.data?.message || 'Something went wrong';
        return Promise.reject({ ...error, message });
    }
);

// Auth Services
export const authService = {
    login: async (credentials) => {
        return apiClient.post('/auth/login', credentials);
    },

    logout: async () => {
        try {
            await apiClient.post('/auth/logout');
        } catch (error) {
            console.warn('Logout API error:', error);
        } finally {
            await AsyncStorage.multiRemove(['userToken', 'userProfile', 'userPermissions']);
        }
    },

    getProfile: async () => {
        return apiClient.get('/auth/profile');
    },

    saveAuthData: async (token, user) => {
        // Use multiSet for parallel storage - faster than sequential setItem
        await AsyncStorage.multiSet([
            ['userToken', token],
            ['userProfile', JSON.stringify(user)]
        ]);
    },

    getAuthData: async () => {
        const token = await AsyncStorage.getItem('userToken');
        const user = await AsyncStorage.getItem('userProfile');
        return {
            token,
            user: user ? JSON.parse(user) : null
        };
    },

    // Permission management
    savePermissions: async (permissions) => {
        await AsyncStorage.setItem('userPermissions', JSON.stringify(permissions));
    },

    getPermissions: async () => {
        const perms = await AsyncStorage.getItem('userPermissions');
        return perms ? JSON.parse(perms) : {};
    },

    clearPermissions: async () => {
        await AsyncStorage.removeItem('userPermissions');
    },

    // Check if user has permission for a page action
    hasPermission: async (pageName, action = 'view') => {
        const permissions = await authService.getPermissions();
        const pagePerms = permissions[pageName.toLowerCase()];
        return pagePerms ? pagePerms[action] === true : false;
    },

    // Check if user is admin
    isAdmin: async () => {
        const { user } = await authService.getAuthData();
        return user?.role === 'admin' || user?.role_id === 1;
    }
};

export default apiClient;