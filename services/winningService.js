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

    /**
     * Submit (save) a confirmed winning entry
     * Called after user reviews the check results and clicks "Submit Winning"
     * 
     * @param {Object} payload - Full winning data to persist
     * @returns {Promise} API response with saved entry details
     */
    submitWinning: async (payload) => {
        return apiClient.post('/winning/submit', payload);
    },

    /**
     * Get existing winning entry for a specific category + time window
     * Used to check if an entry was already submitted (to show read-only view)
     * 
     * @param {number} categoryId - Category ID
     * @param {string} windowStart - ISO date string
     * @param {string} windowEnd - ISO date string
     * @returns {Promise} API response with entry or null
     */
    getEntryForWindow: async (categoryId, windowStart, windowEnd) => {
        return apiClient.get(`/winning/entry/${categoryId}`, {
            params: { window_start: windowStart, window_end: windowEnd }
        });
    },

    /**
     * Get aggregated winning summary for a date or date range
     * Returns all submitted entries with totals
     * 
     * @param {string} startDate - YYYY-MM-DD format
     * @param {string} endDate - YYYY-MM-DD format (optional, defaults to startDate)
     * @returns {Promise} API response with summary data
     */
    getWinningSummary: async (startDate, endDate = null) => {
        const params = {};
        if (startDate && endDate && startDate !== endDate) {
            params.start_date = startDate;
            params.end_date = endDate;
        } else if (startDate) {
            params.date = startDate;
        }
        return apiClient.get('/winning/summary', { params });
    },

    /**
     * Cancel (void) a winning entry
     * Used when admin needs to correct a wrong submission
     * 
     * @param {number} entryId - ID of the winning entry to cancel
     * @returns {Promise} API response confirming cancellation
     */
    cancelWinningEntry: async (entryId) => {
        return apiClient.put(`/winning/cancel/${entryId}`);
    },
};
