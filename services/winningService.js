import apiClient from './index';

export const winningService = {
    /**
     * Check if a lottery number is a winner
     * Sends category_id and lottery_number to the backend
     * Backend handles time-slot window calculation and sales matching
     * 
     * @param {{ category_id: number, lottery_number: string }} payload
     * @returns {Promise} API response with winning results
     */
    checkWinning: async (payload) => {
        return apiClient.post('/winning/check', payload);
    },
};
