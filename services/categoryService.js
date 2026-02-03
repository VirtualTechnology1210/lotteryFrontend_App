import apiClient from './index';

export const categoryService = {
    // Get all categories
    getAllCategories: async (params) => {
        return apiClient.get('/categories', { params });
    },

    // Get active categories
    getActiveCategories: async () => {
        return apiClient.get('/categories/active');
    },

    // Get category by ID
    getCategoryById: async (id) => {
        return apiClient.get(`/categories/${id}`);
    },

    // Create category
    createCategory: async (formData) => {
        return apiClient.post('/categories', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    // Update category
    updateCategory: async (id, formData) => {
        return apiClient.put(`/categories/${id}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    // Delete category
    deleteCategory: async (id) => {
        return apiClient.delete(`/categories/${id}`);
    }
};
