import apiClient from './index';

export const userService = {
    // Get all users
    getAllUsers: async () => {
        return apiClient.get('/users');
    },

    // Get user by ID
    getUserById: async (id) => {
        return apiClient.get(`/users/${id}`);
    },

    // Create user
    createUser: async (data) => {
        return apiClient.post('/users', data);
    },

    // Update user
    updateUser: async (id, data) => {
        return apiClient.put(`/users/${id}`, data);
    },

    // Delete user
    deleteUser: async (id) => {
        return apiClient.delete(`/users/${id}`);
    }
};
