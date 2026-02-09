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

    // Create single sale
    createSale: async (data) => {
        return apiClient.post('/sales', data);
    },

    /**
     * Create batch sales (multiple items with single invoice)
     * @param {Array} items - Array of sale items
     * @param {number} items[].product_id - Product ID
     * @param {number} items[].qty - Quantity
     * @param {string} items[].desc - Optional description
     * @returns {Promise} - Response with invoice_number and all created sales
     */
    createBatchSales: async (items) => {
        return apiClient.post('/sales/batch', { items });
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
