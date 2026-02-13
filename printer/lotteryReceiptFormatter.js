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
    SET_CHAR_SPACING: (n) => [ESC, 0x20, n],
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

// Number to Indian words
const numberToIndianWords = (num) => {
    if (!num || num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convert = (n) => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };
    return convert(Math.floor(Math.abs(num)));
};

// Convert to title case
const toTitleCase = (s) => str(s).replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

// Amount to words with currency
const numberToWordsWithDecimal = (amount, currency = 'INR') => {
    if (!amount || isNaN(amount)) return '';
    const [whole, decimal] = Math.abs(amount).toFixed(2).split('.');
    let result = '';
    if (whole && parseInt(whole) > 0) {
        result += toTitleCase(numberToIndianWords(parseInt(whole)));
        result += currency === 'INR' ? ' Rupees' : ' Dirhams';
    }
    if (decimal && parseInt(decimal) > 0) {
        result += ' And ';
        result += toTitleCase(numberToIndianWords(parseInt(decimal)));
        result += currency === 'INR' ? ' Paise' : ' Fils';
    }
    return result;
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

const getDescLines = (descText, maxPairs = 2) => {
    const text = str(descText);
    if (!text || text === '-') return ['-'];
    if (!text.includes(',')) return [wrapText(text, 12)[0]]; // Limit single long desc

    const parts = text.split(',').map(p => p.trim()).filter(p => p);
    const lines = [];
    for (let i = 0; i < parts.length; i += maxPairs) {
        let line = '';
        for (let j = 0; j < maxPairs && (i + j) < parts.length; j++) {
            if (line) line += ' , ';
            line += parts[i + j];
        }
        lines.push(line);
    }
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
        // With 1-dot char spacing increase, we reduce total characters per line slightly
        const W = width === '58' ? 29 : 44;
        const items = Array.isArray(receiptData?.items) ? receiptData.items : [];

        // Build receipt
        const parts = [];
        const cmd = (c) => parts.push(new Uint8Array(c));
        const txt = (s) => parts.push(toBytes(s));
        const ln = (s) => { txt(s); cmd(CMD.LF); };

        // Initialize printer
        cmd(CMD.INIT);
        // Set small character spacing as requested
        cmd(CMD.SET_CHAR_SPACING(1));

        // ============INVOICE============
        cmd(CMD.ALIGN_CENTER);
        cmd(CMD.BOLD_ON);
        ln('============ D K ============');
        cmd(CMD.BOLD_OFF);

        // ==================== USER INFO ====================
        cmd(CMD.ALIGN_LEFT);
        // User line
        cmd(CMD.BOLD_ON); txt('User: '); cmd(CMD.BOLD_OFF); ln(str(receiptData.username));

        // Invoice number and Time/Date in ONE LINE
        const blNoKey = 'Bill No: ';
        const blNoVal = str(receiptData.invoiceNo);
        const stKey = 'Time:';
        const stVal = `${formatTime(receiptData.billTime)} - ${formatDate(receiptData.date)}`;

        const totalTextLen = blNoKey.length + blNoVal.length + stKey.length + stVal.length;
        const lineSpacing = Math.max(1, W - totalTextLen);

        cmd(CMD.BOLD_ON); txt(blNoKey); cmd(CMD.BOLD_OFF); txt(blNoVal);
        txt(' '.repeat(lineSpacing));
        cmd(CMD.BOLD_ON); txt(stKey); cmd(CMD.BOLD_OFF); ln(stVal);

        // Time Slot
        if (receiptData.timeSlot) {
            cmd(CMD.BOLD_ON); txt('Show Time: '); cmd(CMD.BOLD_OFF); ln(str(receiptData.timeSlot));
        }

        // Category
        if (receiptData.categoryName) {
            cmd(CMD.BOLD_ON); txt('Category: '); cmd(CMD.BOLD_OFF); ln(str(receiptData.categoryName));
        }

        // ==================== ITEMS TABLE ====================
        cmd(CMD.ALIGN_LEFT);
        ln('-'.repeat(W));

        // Table Header
        // 80mm: No.(4) | Details(12) | Number(12) | Qty(4) | Rate(7) | Amount(9) total 48
        // 58mm: No.(2) | Details(6) | Number(11) | Qty(3) | Rate(4) | Amount(6) total 32

        cmd(CMD.BOLD_ON);
        if (W >= 44) {
            // 80mm (W=44): No(3) + Details(11) + Number(11) + Qty(4) + Rate(7) + Amount(8) = 44
            const header = 'No.'.padEnd(3) + 'Details'.padEnd(11) + 'Number'.padStart(11) + 'Qty'.padStart(4) + 'Rate'.padStart(7) + 'Amount'.padStart(8);
            ln(header);
        } else {
            // 58mm (W=29): No(2) + Details(5) + Number(9) + Qty(3) + Rate(4) + Amount(6) = 29
            const header = 'No.'.padEnd(2) + 'Details'.padEnd(5) + 'Number'.padStart(9) + 'Qty'.padStart(3) + 'Rate'.padStart(4) + 'Amount'.padStart(6);
            ln(header);
        }

        cmd(CMD.BOLD_OFF);
        ln('-'.repeat(W));

        // Item rows
        let totalQty = 0;
        let totalPrice = 0;

        items.forEach((item, index) => {
            const noWidth = W >= 48 ? 4 : 2;
            const no = `${index + 1}.`.padEnd(noWidth);
            const productName = str(item.productName || item.product_name || '');
            const desc = str(item.desc || '-');
            const qty = Number(item.qty) || 0;
            const price = Number(item.price) || 0;
            const lineTotal = qty * price;

            totalQty += qty;
            totalPrice += lineTotal;

            if (W >= 44) {
                // 80mm paper layout: 3 | 11 | 11 | 4 | 7 | 8 = 44
                const maxNameW = 11;
                const maxDescW = 11;
                const nameLines = wrapText(productName, maxNameW);
                const descLines = getDescLines(desc);
                const maxSubLines = Math.max(nameLines.length, descLines.length);

                const qtyStr = String(qty).padStart(4);
                const rateStr = price.toFixed(2).padStart(7);
                const amountStr = lineTotal.toFixed(2).padStart(8);

                for (let i = 0; i < maxSubLines; i++) {
                    const rowNo = i === 0 ? no : ' '.repeat(noWidth);
                    const rowName = (nameLines[i] || '').padEnd(maxNameW);
                    const rowDesc = (descLines[i] || '').padStart(maxDescW);

                    if (i === 0) {
                        ln(rowNo + rowName + rowDesc + qtyStr + rateStr + amountStr);
                    } else {
                        ln(rowNo + rowName + rowDesc);
                    }
                }
            } else {
                // 58mm paper layout: 2 | 5 | 9 | 3 | 4 | 6 = 29
                const maxNameW = 5;
                const maxDescW = 9;
                const nameLines = wrapText(productName, maxNameW);
                const descLines = getDescLines(desc);
                const maxSubLines = Math.max(nameLines.length, descLines.length);

                const qtyStr = String(qty).padStart(3);
                const rateStr = price.toFixed(0).padStart(4);
                const amountStr = lineTotal.toFixed(2).padStart(6);

                for (let i = 0; i < maxSubLines; i++) {
                    const rowNo = i === 0 ? no : ' '.repeat(noWidth);
                    const rowName = (nameLines[i] || '').padEnd(maxNameW);
                    const rowDesc = (descLines[i] || '').padStart(maxDescW);

                    if (i === 0) {
                        ln(rowNo + rowName + rowDesc + qtyStr + rateStr + amountStr);
                    } else {
                        ln(rowNo + rowName + rowDesc);
                    }
                }
            }
        });

        // ==================== TOTALS SECTION ====================
        ln('-'.repeat(W));

        // Total row in table format
        cmd(CMD.BOLD_ON);
        if (W >= 44) {
            const label = 'Total'.padEnd(25); // No(3)+Details(11)+Number(11)
            const qtyStr = String(totalQty).padStart(4);
            const amtStr = totalPrice.toFixed(2).padStart(8);
            ln(label + qtyStr + ' '.repeat(7) + amtStr);
        } else {
            const label = 'Total'.padEnd(16); // No(2)+Details(5)+Number(9)
            const qtyStr = String(totalQty).padStart(3);
            const amtStr = totalPrice.toFixed(2).padStart(6);
            ln(label + qtyStr + ' '.repeat(4) + amtStr);
        }
        cmd(CMD.BOLD_OFF);

        // ==================== FOOTER ====================
        ln('-'.repeat(W));
        cmd(CMD.ALIGN_CENTER);
        cmd(CMD.BOLD_ON);
        ln('** THANK YOU. VISIT AGAIN **');
        cmd(CMD.BOLD_OFF);

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

/**
 * Format sales report for thermal printer (date-filtered report)
 * 
 * Layout:
 * ========== D K ==========
 *        Sales Report
 * From Date: DD/MM/YYYY    To Date: DD/MM/YYYY
 * ------------------------------------------
 * No  Details     Number  Qty  Rate   Amount
 * ------------------------------------------
 *     Invoice No: 1
 * 1.  Kl-10       2134     1   10.00   10.00
 * 2.  Kl-30       1134     1   30.00   30.00
 *     Invoice No: 2
 * 1.  Tl-10       2534     1   10.00   10.00
 * ------------------------------------------
 * Total                                80.00
 * ------------------------------------------
 *          ** Thank You **
 * 
 * @param {Object} reportData - Report data
 * @param {string} reportData.fromDate - Start date string
 * @param {string} reportData.toDate - End date string
 * @param {Array} reportData.salesItems - Array of sale items (from API)
 * @param {Object} reportData.summary - Summary with total_quantity, total_amount
 * @param {string} width - Paper width '80' or '58'
 * @returns {Uint8Array} ESC/POS bytes
 */
export const formatSalesReportReceipt = (reportData, width = '80') => {
    try {
        const W = width === '58' ? 29 : 44;
        const salesItems = Array.isArray(reportData?.salesItems) ? reportData.salesItems : [];

        const parts = [];
        const cmd = (c) => parts.push(new Uint8Array(c));
        const txt = (s) => parts.push(toBytes(s));
        const ln = (s) => { txt(s); cmd(CMD.LF); };

        // Initialize printer
        cmd(CMD.INIT);
        cmd(CMD.SET_CHAR_SPACING(1));

        // ============ HEADER ============
        cmd(CMD.ALIGN_CENTER);
        cmd(CMD.BOLD_ON);
        ln('========== D K ==========');
        cmd(CMD.BOLD_OFF);

        cmd(CMD.LF);
        cmd(CMD.BOLD_ON);
        ln('Sales Report');
        cmd(CMD.BOLD_OFF);
        cmd(CMD.LF);

        // ============ DATE RANGE ============
        cmd(CMD.ALIGN_LEFT);
        const fromLabel = 'From: ';
        const fromVal = reportData.fromDate ? formatDate(reportData.fromDate) : '--';
        const toLabel = '  To: ';
        const toVal = reportData.toDate ? formatDate(reportData.toDate) : '--';

        const dateLineLen = fromLabel.length + fromVal.length + toLabel.length + toVal.length;
        const dateSpacing = Math.max(1, W - dateLineLen);

        cmd(CMD.BOLD_ON); txt(fromLabel); cmd(CMD.BOLD_OFF); txt(fromVal);
        txt(' '.repeat(dateSpacing));
        cmd(CMD.BOLD_ON); txt(toLabel); cmd(CMD.BOLD_OFF); ln(toVal);

        cmd(CMD.LF);

        // ============ TABLE HEADER ============
        ln('-'.repeat(W));

        cmd(CMD.BOLD_ON);
        if (W >= 44) {
            // 80mm: No(3) + Details(11) + Number(11) + Qty(4) + Rate(7) + Amount(8) = 44
            const header = 'No.'.padEnd(3) + 'Details'.padEnd(11) + 'Number'.padStart(11) + 'Qty'.padStart(4) + 'Rate'.padStart(7) + 'Amount'.padStart(8);
            ln(header);
        } else {
            // 58mm: No(2) + Details(5) + Number(9) + Qty(3) + Rate(4) + Amount(6) = 29
            const header = 'No'.padEnd(2) + 'Detl'.padEnd(5) + 'Number'.padStart(9) + 'Qty'.padStart(3) + 'Rate'.padStart(4) + 'Amt'.padStart(6);
            ln(header);
        }
        cmd(CMD.BOLD_OFF);
        ln('-'.repeat(W));

        // ============ GROUP BY INVOICE ============
        // Group items by invoice_number
        const invoiceGroups = {};
        const noInvoiceItems = [];

        salesItems.forEach(item => {
            if (item.invoice_number) {
                if (!invoiceGroups[item.invoice_number]) {
                    invoiceGroups[item.invoice_number] = [];
                }
                invoiceGroups[item.invoice_number].push(item);
            } else {
                noInvoiceItems.push(item);
            }
        });

        let grandTotalQty = 0;
        let grandTotalAmount = 0;

        // Print each invoice group
        const invoiceNumbers = Object.keys(invoiceGroups).sort((a, b) => Number(a) - Number(b));

        invoiceNumbers.forEach(invoiceNo => {
            const items = invoiceGroups[invoiceNo];

            // Invoice header line
            cmd(CMD.BOLD_ON);
            if (W >= 44) {
                ln('   Invoice No: ' + invoiceNo);
            } else {
                ln(' Inv: ' + invoiceNo);
            }
            cmd(CMD.BOLD_OFF);

            // Print items within this invoice
            items.forEach((item, index) => {
                const productName = str(item.product_name || item.product_code || '');
                const descNum = str(item.desc || '-');
                const qty = Number(item.qty) || 0;
                const rate = Number(item.unit_price) || 0;
                const amount = Number(item.total) || (qty * rate);

                grandTotalQty += qty;
                grandTotalAmount += amount;

                if (W >= 44) {
                    // 80mm layout: No(3) + Details(11) + Number(11) + Qty(4) + Rate(7) + Amount(8) = 44
                    const no = `${index + 1}.`.padEnd(3);
                    const nameLines = wrapText(productName, 11);
                    const descLines = getDescLines(descNum);
                    const maxSubLines = Math.max(nameLines.length, descLines.length);

                    const qtyStr = String(qty).padStart(4);
                    const rateStr = rate.toFixed(2).padStart(7);
                    const amountStr = amount.toFixed(2).padStart(8);

                    for (let i = 0; i < maxSubLines; i++) {
                        const rowNo = i === 0 ? no : '   ';
                        const rowName = (nameLines[i] || '').padEnd(11);
                        const rowDesc = (descLines[i] || '').padStart(11);

                        if (i === 0) {
                            ln(rowNo + rowName + rowDesc + qtyStr + rateStr + amountStr);
                        } else {
                            ln(rowNo + rowName + rowDesc);
                        }
                    }
                } else {
                    // 58mm layout: No(2) + Details(5) + Number(9) + Qty(3) + Rate(4) + Amount(6) = 29
                    const no = `${index + 1}.`.padEnd(2);
                    const nameLines = wrapText(productName, 5);
                    const descLines = getDescLines(descNum);
                    const maxSubLines = Math.max(nameLines.length, descLines.length);

                    const qtyStr = String(qty).padStart(3);
                    const rateStr = rate.toFixed(0).padStart(4);
                    const amountStr = amount.toFixed(2).padStart(6);

                    for (let i = 0; i < maxSubLines; i++) {
                        const rowNo = i === 0 ? no : '  ';
                        const rowName = (nameLines[i] || '').padEnd(5);
                        const rowDesc = (descLines[i] || '').padStart(9);

                        if (i === 0) {
                            ln(rowNo + rowName + rowDesc + qtyStr + rateStr + amountStr);
                        } else {
                            ln(rowNo + rowName + rowDesc);
                        }
                    }
                }
            });
        });

        // Print items without invoice number (if any)
        if (noInvoiceItems.length > 0) {
            cmd(CMD.BOLD_ON);
            if (W >= 44) {
                ln('   Other Sales');
            } else {
                ln(' Other');
            }
            cmd(CMD.BOLD_OFF);

            noInvoiceItems.forEach((item, index) => {
                const productName = str(item.product_name || item.product_code || '');
                const descNum = str(item.desc || '-');
                const qty = Number(item.qty) || 0;
                const rate = Number(item.unit_price) || 0;
                const amount = Number(item.total) || (qty * rate);

                grandTotalQty += qty;
                grandTotalAmount += amount;

                if (W >= 44) {
                    const no = `${index + 1}.`.padEnd(3);
                    const nameTrunc = productName.substring(0, 11).padEnd(11);
                    const descTrunc = descNum.substring(0, 11).padStart(11);
                    const qtyStr = String(qty).padStart(4);
                    const rateStr = rate.toFixed(2).padStart(7);
                    const amountStr = amount.toFixed(2).padStart(8);
                    ln(no + nameTrunc + descTrunc + qtyStr + rateStr + amountStr);
                } else {
                    const no = `${index + 1}.`.padEnd(2);
                    const nameTrunc = productName.substring(0, 5).padEnd(5);
                    const descTrunc = descNum.substring(0, 9).padStart(9);
                    const qtyStr = String(qty).padStart(3);
                    const rateStr = rate.toFixed(0).padStart(4);
                    const amountStr = amount.toFixed(2).padStart(6);
                    ln(no + nameTrunc + descTrunc + qtyStr + rateStr + amountStr);
                }
            });
        }

        // ============ TOTALS ============
        ln('-'.repeat(W));

        // Use summary if provided, otherwise use calculated totals
        const totalQty = reportData.summary?.total_quantity || grandTotalQty;
        const totalAmount = reportData.summary?.total_amount || grandTotalAmount;

        cmd(CMD.BOLD_ON);
        if (W >= 44) {
            const label = 'Total'.padEnd(25); // No(3)+Details(11)+Number(11)
            const qtyStr = String(totalQty).padStart(4);
            const amtStr = totalAmount.toFixed(2).padStart(8);
            ln(label + qtyStr + ' '.repeat(7) + amtStr);
        } else {
            const label = 'Total'.padEnd(16); // No(2)+Details(5)+Number(9)
            const qtyStr = String(totalQty).padStart(3);
            const amtStr = totalAmount.toFixed(2).padStart(6);
            ln(label + qtyStr + ' '.repeat(4) + amtStr);
        }
        cmd(CMD.BOLD_OFF);

        // ============ FOOTER ============
        ln('-'.repeat(W));
        cmd(CMD.ALIGN_CENTER);
        cmd(CMD.BOLD_ON);
        ln('** Thank You **');
        cmd(CMD.BOLD_OFF);

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

        console.log('[salesReportFormatter] Generated', result.length, 'bytes');
        return result;

    } catch (error) {
        console.error('[salesReportFormatter] Error:', error);
        const msg = 'PRINT ERROR';
        const err = [...CMD.INIT, ...CMD.ALIGN_CENTER, ...Array.from(msg).map(c => c.charCodeAt(0)), ...CMD.LF, ...CMD.CUT];
        return new Uint8Array(err);
    }
};

export const bytesToHex = (bytes, limit = 200) => {
    return Array.from(bytes.slice(0, limit)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
};

export default {
    formatLotteryReceipt,
    formatSalesReceipt,
    formatSalesReportReceipt,
    bytesToHex,
};
