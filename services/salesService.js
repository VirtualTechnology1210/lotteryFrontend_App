import apiClient from './index';

export const salesService = {
    // Get all sales
    getAllSales: async (params) => {
        return apiClient.get('/sales', { params });
    },

    // Get sale by ID
    getSaleById: async (id) => {
        return apiClient.get(`/sales/${id}`);
    },

    // Get my sales (current user)
    getMySales: async (params) => {
        return apiClient.get('/sales/my-sales', { params });
    },

    // Create sale
    createSale: async (data) => {
        return apiClient.post('/sales', data);
    },

    // Update sale
    updateSale: async (id, data) => {
        return apiClient.put(`/sales/${id}`, data);
    },

    // Delete sale
    deleteSale: async (id) => {
        return apiClient.delete(`/sales/${id}`);
    }
};
