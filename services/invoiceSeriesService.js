import apiClient from './index';

export const invoiceSeriesService = {
    // Get all invoice series
    getAllSeries: async () => {
        return apiClient.get('/invoice-series');
    },

    // Get specific series by name (helper)
    getSeriesByName: async (name) => {
        const response = await apiClient.get('/invoice-series');
        if (response && response.data && response.data.series) {
            return response.data.series.find(s => s.series_name === name);
        }
        return null;
    }
};
