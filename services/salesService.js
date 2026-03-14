import apiClient from './index';
import Share from 'react-native-share';

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
    },
    /**
     * Share sales data in text format
     * Format:
     *   ── 3PM ──
     *   KL.110 - 1265              = 1
     *   Pol    - 2569,2596
     *            2659,2695         = 24
     *
     * Showtime appears as a header, product details below.
     * Items are grouped by their time slot.
     */
    shareSalesData: async (invoiceNo, items) => {
        try {
            const MAX_PER_LINE = 1; // lottery numbers per line

            // ── Pre-process all items ──
            const processed = items.map(item => {
                const name = item.product_name || item.product_code || 'N/A';
                const desc = item.desc || 'N/A';
                const qty = String(item.qty || 0);
                const showtime = String((item.time_slots && item.time_slots[0]) || '');
                const numbers = desc.split(',').map(n => n.trim()).filter(Boolean);

                // Group lottery numbers into chunks
                const chunks = [];
                for (let i = 0; i < numbers.length; i += MAX_PER_LINE) {
                    chunks.push(numbers.slice(i, i + MAX_PER_LINE).join(','));
                }
                if (chunks.length === 0) chunks.push('N/A');

                return { name, chunks, qty, showtime };
            });

            // ── Group items by showtime ──
            const groups = {};
            for (const item of processed) {
                const key = item.showtime || '';
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            }

            // ── Calculate dynamic column widths (across all items) ──
            const maxNameLen = Math.max(...processed.map(p => p.name.length), 1);
            const maxLotteryLen = Math.max(
                ...processed.flatMap(p => p.chunks.map(c => c.length)),
                1
            );
            const maxQtyLen = Math.max(...processed.map(p => p.qty.length), 1);

            // ── Build formatted lines ──
            const dash = ' - ';
            const eq = ' = ';
            const indentLen = maxNameLen + dash.length;
            const indent = ' '.repeat(indentLen);

            const lines = [];

            for (const [showtime, groupItems] of Object.entries(groups)) {
                // Add showtime header if available
                if (showtime) {
                    lines.push(`── ${showtime} ──`);
                }

                for (const { name, chunks, qty } of groupItems) {
                    const paddedName = name.padEnd(maxNameLen);
                    const paddedQty = qty.padStart(maxQtyLen);

                    for (let i = 0; i < chunks.length; i++) {
                        const isFirst = i === 0;
                        const isLast = i === chunks.length - 1;
                        const prefix = isFirst ? `${paddedName}${dash}` : indent;
                        const lottery = isLast
                            ? chunks[i].padEnd(maxLotteryLen)
                            : chunks[i];

                        if (isLast) {
                            lines.push(`${prefix}${lottery}${eq}${paddedQty}`);
                        } else {
                            lines.push(`${prefix}${lottery}`);
                        }
                    }
                }

                lines.push(''); // blank line between groups
            }

            const shareText = lines.join('\n').trim();

            await Share.open({
                message: shareText,
                title: 'Share Sale Details'
            });
        } catch (error) {
            if (error && error.message !== 'User did not share' && !error.message?.includes('dismiss')) {
                console.error('Share Error:', error);
            }
        }
    }
};
