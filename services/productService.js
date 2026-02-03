import apiClient from './index';

export const productService = {
    // Get all products
    getAllProducts: async (params) => {
        return apiClient.get('/products', { params });
    },

    // Get active products
    getActiveProducts: async (params) => {
        return apiClient.get('/products/active', { params });
    },

    // Get product by ID
    getProductById: async (id) => {
        return apiClient.get(`/products/${id}`);
    },

    // Create product
    createProduct: async (data) => {
        return apiClient.post('/products', data);
    },

    // Update product
    updateProduct: async (id, data) => {
        return apiClient.put(`/products/${id}`, data);
    },

    // Delete product
    deleteProduct: async (id) => {
        return apiClient.delete(`/products/${id}`);
    },

    // Get products by category
    getProductsByCategory: async (categoryId, params) => {
        return apiClient.get(`/products/category/${categoryId}`, { params });
    }
};
