import apiClient from './index';

export const reportService = {
    // Get general sales report
    getSalesReport: async (params) => {
        return apiClient.get('/sales/report', { params });
    },

    // Get sales by category
    getSalesByCategory: async (params) => {
        return apiClient.get('/sales/report/by-category', { params });
    },

    // Get sales by product
    getSalesByProduct: async (params) => {
        return apiClient.get('/sales/report/by-product', { params });
    },

    // Get sales by user (admin only)
    getSalesByUser: async (params) => {
        return apiClient.get('/sales/report/by-user', { params });
    }
};

