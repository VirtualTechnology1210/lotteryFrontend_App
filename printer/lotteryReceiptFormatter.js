/**
 * Lottery Receipt Formatter for Thermal Printer
 * 
 * Receipt Layout:
 * - Username
 * - Invoice number and bill time in ONE LINE (left/right aligned)
 * - Date
 * - Category time slot
 * - Category name
 * 
 * Product Table:
 * Display items in table format with proper alignment:
 * Columns: Product Name | Desc Number | Qty | Price
 * Rules:
 * - Product name left aligned
 * - Desc - Qty centered
 * - Price right aligned
 * - Wrap long names
 * - No borders — use dashed separators instead
 * 
 * Totals Section:
 * - Show total quantity
 * - Show total price
 * - Bold totals
 * - Right aligned totals
 * 
 * Footer:
 * - Center aligned greeting message: "Thank you — Visit Again"
 * 
 * Thermal Print Styling:
 * - Page width: 80mm
 * - Font size small but readable
 */

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
    INIT: [ESC, 0x40],
    ALIGN_LEFT: [ESC, 0x61, 0x00],
    ALIGN_CENTER: [ESC, 0x61, 0x01],
    ALIGN_RIGHT: [ESC, 0x61, 0x02],
    BOLD_ON: [ESC, 0x45, 0x01],
    BOLD_OFF: [ESC, 0x45, 0x00],
    SIZE_NORMAL: [GS, 0x21, 0x00],
    SIZE_DOUBLE_HEIGHT: [GS, 0x21, 0x01],
    SIZE_DOUBLE_BOTH: [GS, 0x21, 0x11],
    LF: [0x0a],
    FEED_5: [ESC, 0x64, 0x05],
    CUT: [GS, 0x56, 0x01],
};

// Safe string conversion
const str = (val) => (val === null || val === undefined) ? '' : String(val);

// Convert string to bytes (UTF-8)
const toBytes = (s) => {
    const text = str(s);
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c < 128) bytes.push(c);
        else if (c < 2048) { bytes.push(192 | (c >> 6)); bytes.push(128 | (c & 63)); }
        else { bytes.push(224 | (c >> 12)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)); }
    }
    return new Uint8Array(bytes);
};

// Format date as DD/MM/YYYY
const formatDate = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return str(date); }
};

// Format time as HH:MM AM/PM
const formatTime = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) { return str(date); }
};

// Wrap text to fit width
const wrapText = (text, maxWidth) => {
    const words = str(text).split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        if ((currentLine + ' ' + word).trim().length <= maxWidth) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            // If word is longer than maxWidth, split it
            if (word.length > maxWidth) {
                while (word.length > maxWidth) {
                    lines.push(word.substring(0, maxWidth));
                    word = word.substring(maxWidth);
                }
                currentLine = word;
            } else {
                currentLine = word;
            }
        }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
};

/**
 * Format lottery sales receipt for thermal printer
 * 
 * @param {Object} receiptData - Receipt data
 * @param {string} receiptData.username - Username
 * @param {string} receiptData.invoiceNo - Invoice number
 * @param {Date|string} receiptData.billTime - Bill time
 * @param {Date|string} receiptData.date - Date
 * @param {string} receiptData.timeSlot - Category time slot
 * @param {string} receiptData.categoryName - Category name
 * @param {Array} receiptData.items - Array of items
 * @param {string} receiptData.items[].productName - Product name
 * @param {string} receiptData.items[].desc - Description number
 * @param {number} receiptData.items[].qty - Quantity
 * @param {number} receiptData.items[].price - Price per unit
 * @param {string} width - Paper width '80' or '58'
 * @returns {Uint8Array} ESC/POS bytes
 */
export const formatLotteryReceipt = (receiptData, width = '80') => {
    try {
        const W = width === '58' ? 32 : 48; // Characters per line
        const items = Array.isArray(receiptData?.items) ? receiptData.items : [];

        // Build receipt
        const parts = [];
        const cmd = (c) => parts.push(new Uint8Array(c));
        const txt = (s) => parts.push(toBytes(s));
        const ln = (s) => { txt(s); cmd(CMD.LF); };

        // Initialize printer
        cmd(CMD.INIT);

        // ==================== USER INFO ====================
        cmd(CMD.ALIGN_LEFT);
        ln(`User: ${str(receiptData.username)}`);

        // Invoice number and Time/Date in ONE LINE
        // Invoice No: 1       Time:10:30AM - 09/02/2026
        const invoiceText = `Bill No: ${str(receiptData.invoiceNo)}`;
        const timeDateText = `Time:${formatTime(receiptData.billTime)} - ${formatDate(receiptData.date)}`;
        const labelSpacing = Math.max(1, W - invoiceText.length - timeDateText.length);
        ln(invoiceText + ' '.repeat(labelSpacing) + timeDateText);

        // Time Slot
        if (receiptData.timeSlot) {
            ln(`Time: ${str(receiptData.timeSlot)}`);
        }

        // Category
        if (receiptData.categoryName) {
            ln(`Category: ${str(receiptData.categoryName)}`);
        }

        // ==================== ITEMS TABLE ====================
        cmd(CMD.ALIGN_LEFT);
        ln('.'.repeat(W));

        // Table Header
        // 80mm: No.(4) | Product(14) | Desc(8) | Qty(4) | Rate(8) | Amount(10) total 48
        // 58mm: No.(2) | Product(9) | Desc(5) | Qty(3) | Rate(5) | Amount(8) total 32

        cmd(CMD.BOLD_ON);
        if (W >= 48) {
            const header = 'No.'.padEnd(4) + 'Details'.padEnd(14) + 'Number'.padStart(8) + 'Qty'.padStart(4) + 'Rate'.padStart(8) + 'Amount'.padStart(10);
            ln(header);
        } else {
            const header = 'No.'.padEnd(2) + 'Details'.padEnd(9) + 'Number'.padStart(5) + 'Qty'.padStart(3) + 'Rate'.padStart(5) + 'Amount'.padStart(8);
            ln(header);
        }
        cmd(CMD.BOLD_OFF);
        ln('.'.repeat(W));

        // Item rows
        let totalQty = 0;
        let totalPrice = 0;

        items.forEach((item, index) => {
            const no = `${index + 1}.`.padEnd(W >= 48 ? 4 : 2);
            const productName = str(item.productName || item.product_name || '');
            const desc = str(item.desc || '-');
            const qty = Number(item.qty) || 0;
            const price = Number(item.price) || 0;
            const lineTotal = qty * price;

            totalQty += qty;
            totalPrice += lineTotal;

            if (W >= 48) {
                // 80mm paper
                const maxNameWidth = 14;
                const descStr = desc.substring(0, 8).padStart(8);
                const qtyStr = String(qty).padStart(4);
                const rateStr = price.toFixed(2).padStart(8);
                const amountStr = lineTotal.toFixed(2).padStart(10);

                if (productName.length > maxNameWidth) {
                    const nameLines = wrapText(productName, maxNameWidth);
                    nameLines.forEach((nameLine, idx) => {
                        if (idx === 0) {
                            ln(no + nameLine.padEnd(maxNameWidth) + descStr + qtyStr + rateStr + amountStr);
                        } else {
                            ln(' '.repeat(4) + nameLine);
                        }
                    });
                } else {
                    ln(no + productName.padEnd(maxNameWidth) + descStr + qtyStr + rateStr + amountStr);
                }
            } else {
                // 58mm paper
                const maxNameWidth = 9;
                const qtyStr = String(qty).padStart(3);
                const descStr = desc.substring(0, 5).padStart(5);
                const rateStr = price.toFixed(0).padStart(5);
                const amountStr = lineTotal.toFixed(2).padStart(8);

                if (productName.length > maxNameWidth) {
                    const nameLines = wrapText(productName, maxNameWidth);
                    nameLines.forEach((nameLine, idx) => {
                        if (idx === 0) {
                            ln(no + nameLine.padEnd(maxNameWidth) + descStr + qtyStr + rateStr + amountStr);
                        } else {
                            ln(' '.repeat(2) + nameLine);
                        }
                    });
                } else {
                    ln(no + productName.padEnd(maxNameWidth) + descStr + qtyStr + rateStr + amountStr);
                }
            }
        });

        // ==================== TOTALS SECTION ====================
        ln('.'.repeat(W));
        cmd(CMD.BOLD_ON);

        // Total row in table format
        if (W >= 48) {
            const label = 'Total'.padEnd(26); // No(4)+Prod(14)+Desc(8)
            const qtyStr = String(totalQty).padStart(4);
            const amtStr = totalPrice.toFixed(2).padStart(10);
            ln(label + qtyStr + ' '.repeat(8) + amtStr);
        } else {
            const label = 'Total'.padEnd(16); // No(2)+Prod(9)+Desc(5)
            const qtyStr = String(totalQty).padStart(3);
            const amtStr = totalPrice.toFixed(2).padStart(8);
            ln(label + qtyStr + ' '.repeat(5) + amtStr);
        }
        cmd(CMD.BOLD_OFF);

        // ==================== FOOTER ====================
        ln('.'.repeat(W));
        cmd(CMD.ALIGN_CENTER);
        ln('Thank you - Visit Again');

        // Feed and cut
        cmd(CMD.LF);
        cmd(CMD.LF);
        cmd(CMD.LF);
        cmd(CMD.CUT);

        // Combine all parts
        const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        parts.forEach(p => { result.set(p, offset); offset += p.length; });

        console.log('[lotteryReceiptFormatter] Generated', result.length, 'bytes');
        return result;

    } catch (error) {
        console.error('[lotteryReceiptFormatter] Error:', error);
        // Return minimal error message
        const msg = 'PRINT ERROR';
        const err = [...CMD.INIT, ...CMD.ALIGN_CENTER, ...Array.from(msg).map(c => c.charCodeAt(0)), ...CMD.LF, ...CMD.CUT];
        return new Uint8Array(err);
    }
};

/**
 * Format multi-item sales receipt from cart items
 * 
 * @param {Object} data - Sale data
 * @param {string} data.username - Username
 * @param {string} data.invoiceNo - Invoice number
 * @param {Array} data.cartItems - Array of cart items from SalesScreen
 * @param {string} width - Paper width '80' or '58'
 * @returns {Uint8Array} ESC/POS bytes
 */
export const formatSalesReceipt = (data, width = '80') => {
    const now = new Date();

    // Group items by category for better display
    const categories = {};
    const timeSlotsList = [];

    (data.cartItems || []).forEach(item => {
        const catName = item.category_name;
        if (!categories[catName]) {
            categories[catName] = [];
        }
        categories[catName].push(item);

        // Handle time_slots - can be array ["12:00"] or string
        if (item.time_slots) {
            let slots = item.time_slots;
            // Parse if it's a JSON string
            if (typeof slots === 'string') {
                try {
                    slots = JSON.parse(slots);
                } catch (e) {
                    slots = [slots];
                }
            }
            // Add each slot to list
            if (Array.isArray(slots)) {
                slots.forEach(s => {
                    if (s && !timeSlotsList.includes(s)) {
                        timeSlotsList.push(s);
                    }
                });
            }
        }
    });

    // Join unique category names with commas
    const categoryNames = Object.keys(categories);
    const categoryDisplay = categoryNames.length > 0 ? categoryNames.join(', ') : null;

    // Join time slots for display
    const timeSlotDisplay = timeSlotsList.length > 0 ? timeSlotsList.join(', ') : null;

    // Flatten items for receipt
    const items = (data.cartItems || []).map(item => ({
        productName: item.product_name,
        desc: item.desc || '-',
        qty: item.qty,
        price: item.price,
    }));

    return formatLotteryReceipt({
        username: data.username,
        invoiceNo: data.invoiceNo,
        billTime: now,
        date: now,
        timeSlot: timeSlotDisplay || data.timeSlot || null,
        categoryName: categoryDisplay,
        items: items,
    }, width);
};

export const bytesToHex = (bytes, limit = 200) => {
    return Array.from(bytes.slice(0, limit)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
};

export default {
    formatLotteryReceipt,
    formatSalesReceipt,
    bytesToHex,
};
