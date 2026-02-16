/**
 * Lottery Receipt Formatter for Thermal Printer with Custom Font (Bitmap Mode)
 * 
 * This version converts text to bitmaps using a custom TTF font (Bookman Old Style)
 * and prints them using ESC/POS bitmap commands instead of standard text commands.
 * 
 * Receipt Layout:
 * - Username
 * - Invoice number and bill time in ONE LINE (left/right aligned)
 * - Date
 * - Category time slot
 * - Category name
 * - Product table with items
 * - Totals section
 * - Footer message
 */

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
    INIT: [ESC, 0x40],
    ALIGN_LEFT: [ESC, 0x61, 0x00],
    ALIGN_CENTER: [ESC, 0x61, 0x01],
    ALIGN_RIGHT: [ESC, 0x61, 0x02],
    FEED_5: [ESC, 0x64, 0x05],
    CUT: [GS, 0x56, 0x01],
    LF: [0x0a],
    // Bitmap printing commands
    BITMAP_MODE: [GS, 0x76, 0x30, 0x00], // GS v 0 - Print raster bitmap
};

// Safe string conversion
const str = (val) => (val === null || val === undefined) ? '' : String(val);

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

/**
 * Font Manager - Loads and caches custom fonts
 */
class FontManager {
    constructor() {
        this.fontsLoaded = new Map();
        this.fontFamily = 'Bookman Old Style';
    }

    /**
     * Load custom font from file
     * @param {string} fontPath - Path to the font file in assets
     * @returns {Promise<boolean>} - True if loaded successfully
     */
    async loadFont(fontPath = '/assets/bookman_old_style.ttf') {
        if (this.fontsLoaded.has(this.fontFamily)) {
            return true;
        }

        try {
            // For browser environment
            if (typeof window !== 'undefined' && 'FontFace' in window) {
                const fontFace = new FontFace(this.fontFamily, `url(${fontPath})`);
                await fontFace.load();
                document.fonts.add(fontFace);
                this.fontsLoaded.set(this.fontFamily, true);
                console.log(`[FontManager] Loaded font: ${this.fontFamily}`);
                return true;
            }

            // For Node.js environment with canvas library
            // You would need to register the font with the canvas library
            console.warn('[FontManager] Font loading in Node.js requires canvas library setup');
            this.fontsLoaded.set(this.fontFamily, false);
            return false;
        } catch (error) {
            console.error('[FontManager] Failed to load font:', error);
            return false;
        }
    }

    getFontFamily() {
        return this.fontFamily;
    }
}

const fontManager = new FontManager();

/**
 * Text to Bitmap Converter
 * Renders text with custom font and converts to bitmap for ESC/POS printing
 */
class TextToBitmapConverter {
    constructor(fontFamily = 'Bookman Old Style') {
        this.fontFamily = fontFamily;
        this.canvas = null;
        this.ctx = null;
        this.initCanvas();
    }

    initCanvas() {
        if (typeof document !== 'undefined') {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        } else {
            console.warn('[TextToBitmap] Canvas not available - running in Node.js?');
        }
    }

    /**
     * Render text to bitmap with custom font
     * @param {string} text - Text to render
     * @param {Object} options - Rendering options
     * @returns {Object} - {width, height, data: Uint8Array}
     */
    renderText(text, options = {}) {
        const {
            fontSize = 24,
            bold = false,
            maxWidth = 576, // 72mm at 8 dots/mm = 576 pixels for 80mm paper
            align = 'left', // 'left', 'center', 'right'
            lineHeight = 1.2,
        } = options;

        if (!this.ctx) {
            console.error('[TextToBitmap] Canvas context not available');
            return null;
        }

        // Set font
        const fontWeight = bold ? 'bold' : 'normal';
        this.ctx.font = `${fontWeight} ${fontSize}px "${this.fontFamily}", serif`;
        this.ctx.textBaseline = 'top';

        // Measure text and handle wrapping
        const lines = this.wrapText(text, maxWidth, fontSize * lineHeight);

        // Calculate canvas size
        const lineHeightPx = Math.ceil(fontSize * lineHeight);
        const height = lines.length * lineHeightPx + 10; // Add padding
        const width = maxWidth;

        // Set canvas size
        this.canvas.width = width;
        this.canvas.height = height;

        // Clear canvas
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, width, height);

        // Set text style
        this.ctx.fillStyle = 'black';
        this.ctx.font = `${fontWeight} ${fontSize}px "${this.fontFamily}", serif`;
        this.ctx.textBaseline = 'top';

        // Draw each line
        lines.forEach((line, index) => {
            let x = 5; // Left padding

            if (align === 'center') {
                const metrics = this.ctx.measureText(line);
                x = (width - metrics.width) / 2;
            } else if (align === 'right') {
                const metrics = this.ctx.measureText(line);
                x = width - metrics.width - 5; // Right padding
            }

            const y = index * lineHeightPx + 5; // Top padding
            this.ctx.fillText(line, x, y);
        });

        // Convert to monochrome bitmap
        const imageData = this.ctx.getImageData(0, 0, width, height);
        return this.convertToMonochrome(imageData);
    }

    /**
     * Wrap text to fit within maxWidth
     */
    wrapText(text, maxWidth, lineHeight) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = this.ctx.measureText(testLine);

            if (metrics.width <= maxWidth - 10) { // Account for padding
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines.length > 0 ? lines : [text];
    }

    /**
     * Convert ImageData to monochrome bitmap
     */
    convertToMonochrome(imageData) {
        const { width, height, data } = imageData;
        const threshold = 128;

        // Calculate bytes per line (must be multiple of 8)
        const bytesPerLine = Math.ceil(width / 8);
        const bitmapData = new Uint8Array(bytesPerLine * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // Convert to grayscale
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;

                // Apply threshold (inverted: 0 = white, 1 = black for thermal printer)
                const bit = gray < threshold ? 1 : 0;

                // Set bit in bitmap
                const byteIdx = y * bytesPerLine + Math.floor(x / 8);
                const bitIdx = 7 - (x % 8);
                bitmapData[byteIdx] |= (bit << bitIdx);
            }
        }

        return {
            width: width,
            height: height,
            bytesPerLine: bytesPerLine,
            data: bitmapData
        };
    }

    /**
     * Render table row with aligned columns
     */
    renderTableRow(columns, options = {}) {
        const {
            fontSize = 20,
            bold = false,
            maxWidth = 576,
        } = options;

        if (!this.ctx) return null;

        const fontWeight = bold ? 'bold' : 'normal';
        this.ctx.font = `${fontWeight} ${fontSize}px "${this.fontFamily}", serif`;

        // Calculate column positions
        const totalWidth = maxWidth - 10; // Account for padding
        let currentX = 5;

        // Create canvas
        const height = Math.ceil(fontSize * 1.5);
        this.canvas.width = maxWidth;
        this.canvas.height = height;

        // Clear canvas
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, maxWidth, height);

        // Set text style
        this.ctx.fillStyle = 'black';
        this.ctx.font = `${fontWeight} ${fontSize}px "${this.fontFamily}", serif`;
        this.ctx.textBaseline = 'top';

        // Draw each column
        columns.forEach(col => {
            const { text, width: colWidth, align = 'left' } = col;
            const colWidthPx = (colWidth / 100) * totalWidth;

            let x = currentX;
            const metrics = this.ctx.measureText(text);

            if (align === 'center') {
                x = currentX + (colWidthPx - metrics.width) / 2;
            } else if (align === 'right') {
                x = currentX + colWidthPx - metrics.width;
            }

            this.ctx.fillText(text, x, 5);
            currentX += colWidthPx;
        });

        // Convert to monochrome bitmap
        const imageData = this.ctx.getImageData(0, 0, maxWidth, height);
        return this.convertToMonochrome(imageData);
    }
}

/**
 * ESC/POS Bitmap Printer
 * Converts bitmap data to ESC/POS commands
 */
class BitmapPrinter {
    constructor() {
        this.parts = [];
    }

    cmd(commandArray) {
        this.parts.push(new Uint8Array(commandArray));
    }

    /**
     * Print bitmap using GS v 0 command
     * @param {Object} bitmap - {width, height, bytesPerLine, data}
     */
    printBitmap(bitmap) {
        if (!bitmap || !bitmap.data) {
            console.error('[BitmapPrinter] Invalid bitmap data');
            return;
        }

        const { width, height, bytesPerLine, data } = bitmap;

        // GS v 0 command format:
        // GS v 0 m xL xH yL yH d1...dk
        // m = mode (0 = normal)
        // xL, xH = width in bytes (little endian)
        // yL, yH = height in dots (little endian)
        // d1...dk = bitmap data

        const xL = bytesPerLine & 0xFF;
        const xH = (bytesPerLine >> 8) & 0xFF;
        const yL = height & 0xFF;
        const yH = (height >> 8) & 0xFF;

        const header = new Uint8Array([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
        this.parts.push(header);
        this.parts.push(data);
    }

    /**
     * Print a line feed
     */
    lineFeed(count = 1) {
        for (let i = 0; i < count; i++) {
            this.cmd(CMD.LF);
        }
    }

    /**
     * Print separator line
     */
    printSeparator(width = 576) {
        const bitmap = this.createSeparatorBitmap(width);
        this.printBitmap(bitmap);
    }

    createSeparatorBitmap(width) {
        const height = 2;
        const bytesPerLine = Math.ceil(width / 8);
        const data = new Uint8Array(bytesPerLine * height);

        // Fill with dashes (0xFF = all black)
        data.fill(0xFF);

        return {
            width,
            height,
            bytesPerLine,
            data
        };
    }

    /**
     * Get final byte array
     */
    getBytes() {
        const totalLength = this.parts.reduce((sum, p) => sum + p.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        this.parts.forEach(p => {
            result.set(p, offset);
            offset += p.length;
        });
        return result;
    }
}

/**
 * Format lottery sales receipt for thermal printer with custom font
 * 
 * @param {Object} receiptData - Receipt data
 * @param {string} receiptData.username - Username
 * @param {string} receiptData.invoiceNo - Invoice number
 * @param {Date|string} receiptData.billTime - Bill time
 * @param {Date|string} receiptData.date - Date
 * @param {string} receiptData.timeSlot - Category time slot
 * @param {string} receiptData.categoryName - Category name
 * @param {Array} receiptData.items - Array of items
 * @param {string} width - Paper width '80' or '58'
 * @param {string} fontPath - Path to custom font file
 * @returns {Promise<Uint8Array>} ESC/POS bytes
 */
export const formatLotteryReceiptWithFont = async (receiptData, width = '80', fontPath) => {
    try {
        // Load custom font
        if (fontPath) {
            await fontManager.loadFont(fontPath);
        }

        const paperWidthMm = width === '58' ? 58 : 80;
        const pixelWidth = paperWidthMm === 58 ? 384 : 576; // 8 dots per mm
        const items = Array.isArray(receiptData?.items) ? receiptData.items : [];

        const converter = new TextToBitmapConverter(fontManager.getFontFamily());
        const printer = new BitmapPrinter();

        // Initialize printer
        printer.cmd(CMD.INIT);

        // ============ HEADER ============
        const headerBitmap = converter.renderText('D K', {
            fontSize: 32,
            bold: true,
            maxWidth: pixelWidth,
            align: 'center'
        });
        if (headerBitmap) printer.printBitmap(headerBitmap);
        printer.lineFeed(1);

        printer.printSeparator(pixelWidth);
        printer.lineFeed(1);

        // ============ USER INFO ============
        const userText = `User: ${str(receiptData.username)}`;
        const userBitmap = converter.renderText(userText, {
            fontSize: 22,
            bold: true,
            maxWidth: pixelWidth,
            align: 'left'
        });
        if (userBitmap) printer.printBitmap(userBitmap);
        printer.lineFeed(1);

        // Bill number and time
        const billNoText = `Bill No: ${str(receiptData.invoiceNo)}`;
        const timeText = `Time: ${formatTime(receiptData.billTime)} - ${formatDate(receiptData.date)}`;
        const billLineBitmap = converter.renderText(`${billNoText}  ${timeText}`, {
            fontSize: 20,
            maxWidth: pixelWidth,
            align: 'left'
        });
        if (billLineBitmap) printer.printBitmap(billLineBitmap);
        printer.lineFeed(1);

        // Show Time
        if (receiptData.timeSlot) {
            const timeSlotBitmap = converter.renderText(`Show Time: ${str(receiptData.timeSlot)}`, {
                fontSize: 20,
                maxWidth: pixelWidth,
                align: 'left'
            });
            if (timeSlotBitmap) printer.printBitmap(timeSlotBitmap);
            printer.lineFeed(1);
        }

        // Category
        if (receiptData.categoryName) {
            const categoryBitmap = converter.renderText(`Category: ${str(receiptData.categoryName)}`, {
                fontSize: 20,
                maxWidth: pixelWidth,
                align: 'left'
            });
            if (categoryBitmap) printer.printBitmap(categoryBitmap);
            printer.lineFeed(1);
        }

        printer.lineFeed(1);
        printer.printSeparator(pixelWidth);
        printer.lineFeed(1);

        // ============ TABLE HEADER ============
        const headerColumns = [
            { text: 'No.', width: 8, align: 'left' },
            { text: 'Details', width: 25, align: 'left' },
            { text: 'Number', width: 25, align: 'center' },
            { text: 'Qty', width: 10, align: 'center' },
            { text: 'Rate', width: 15, align: 'right' },
            { text: 'Amount', width: 17, align: 'right' }
        ];

        const headerRowBitmap = converter.renderTableRow(headerColumns, {
            fontSize: 20,
            bold: true,
            maxWidth: pixelWidth
        });
        if (headerRowBitmap) printer.printBitmap(headerRowBitmap);
        printer.lineFeed(1);

        printer.printSeparator(pixelWidth);
        printer.lineFeed(1);

        // ============ ITEMS ============
        let totalQty = 0;
        let totalPrice = 0;

        items.forEach((item, index) => {
            const productName = str(item.productName || item.product_name || '').substring(0, 15);
            const desc = str(item.desc || '-').substring(0, 15);
            const qty = Number(item.qty) || 0;
            const price = Number(item.price) || 0;
            const lineTotal = qty * price;

            totalQty += qty;
            totalPrice += lineTotal;

            const rowColumns = [
                { text: `${index + 1}.`, width: 8, align: 'left' },
                { text: productName, width: 25, align: 'left' },
                { text: desc, width: 25, align: 'center' },
                { text: String(qty), width: 10, align: 'center' },
                { text: price.toFixed(2), width: 15, align: 'right' },
                { text: lineTotal.toFixed(2), width: 17, align: 'right' }
            ];

            const rowBitmap = converter.renderTableRow(rowColumns, {
                fontSize: 18,
                maxWidth: pixelWidth
            });
            if (rowBitmap) printer.printBitmap(rowBitmap);
            printer.lineFeed(1);
        });

        // ============ TOTALS ============
        printer.printSeparator(pixelWidth);
        printer.lineFeed(1);

        const totalColumns = [
            { text: 'Total', width: 58, align: 'left' },
            { text: String(totalQty), width: 10, align: 'center' },
            { text: '', width: 15, align: 'right' },
            { text: totalPrice.toFixed(2), width: 17, align: 'right' }
        ];

        const totalRowBitmap = converter.renderTableRow(totalColumns, {
            fontSize: 22,
            bold: true,
            maxWidth: pixelWidth
        });
        if (totalRowBitmap) printer.printBitmap(totalRowBitmap);
        printer.lineFeed(1);

        // ============ FOOTER ============
        printer.printSeparator(pixelWidth);
        printer.lineFeed(2);

        const footerBitmap = converter.renderText('THANK YOU - VISIT AGAIN', {
            fontSize: 24,
            bold: true,
            maxWidth: pixelWidth,
            align: 'center'
        });
        if (footerBitmap) printer.printBitmap(footerBitmap);

        // Feed and cut
        printer.lineFeed(3);
        printer.cmd(CMD.CUT);

        const result = printer.getBytes();
        console.log('[lotteryReceiptFormatter] Generated', result.length, 'bytes with custom font');
        return result;

    } catch (error) {
        console.error('[lotteryReceiptFormatter] Error:', error);
        // Return minimal error message
        const printer = new BitmapPrinter();
        printer.cmd(CMD.INIT);
        const converter = new TextToBitmapConverter();
        const errorBitmap = converter.renderText('PRINT ERROR', {
            fontSize: 24,
            maxWidth: 576,
            align: 'center'
        });
        if (errorBitmap) printer.printBitmap(errorBitmap);
        printer.cmd(CMD.CUT);
        return printer.getBytes();
    }
};

/**
 * Format sales receipt with custom font
 */
export const formatSalesReceiptWithFont = async (data, width = '80', fontPath) => {
    const now = new Date();

    const categories = {};
    const timeSlotsList = [];

    (data.cartItems || []).forEach(item => {
        const catName = item.category_name;
        if (!categories[catName]) {
            categories[catName] = [];
        }
        categories[catName].push(item);

        if (item.time_slots) {
            let slots = item.time_slots;
            if (typeof slots === 'string') {
                try {
                    slots = JSON.parse(slots);
                } catch (e) {
                    slots = [slots];
                }
            }
            if (Array.isArray(slots)) {
                slots.forEach(s => {
                    if (s && !timeSlotsList.includes(s)) {
                        timeSlotsList.push(s);
                    }
                });
            }
        }
    });

    const categoryNames = Object.keys(categories);
    const categoryDisplay = categoryNames.length > 0 ? categoryNames.join(', ') : null;
    const timeSlotDisplay = timeSlotsList.length > 0 ? timeSlotsList.join(', ') : null;

    const items = (data.cartItems || []).map(item => ({
        productName: item.product_name,
        desc: item.desc || '-',
        qty: item.qty,
        price: item.price,
    }));

    return formatLotteryReceiptWithFont({
        username: data.username,
        invoiceNo: data.invoiceNo,
        billTime: now,
        date: now,
        timeSlot: timeSlotDisplay || data.timeSlot || null,
        categoryName: categoryDisplay,
        items: items,
    }, width, fontPath);
};

/**
 * Format sales report with custom font
 */
export const formatSalesReportReceiptWithFont = async (reportData, width = '80', fontPath) => {
    try {
        // Load custom font
        if (fontPath) {
            await fontManager.loadFont(fontPath);
        }

        const paperWidthMm = width === '58' ? 58 : 80;
        const pixelWidth = paperWidthMm === 58 ? 384 : 576;
        const salesItems = Array.isArray(reportData?.salesItems) ? reportData.salesItems : [];

        const converter = new TextToBitmapConverter(fontManager.getFontFamily());
        const printer = new BitmapPrinter();

        // Initialize printer
        printer.cmd(CMD.INIT);

        // ============ HEADER ============
        const headerBitmap = converter.renderText('D K', {
            fontSize: 32,
            bold: true,
            maxWidth: pixelWidth,
            align: 'center'
        });
        if (headerBitmap) printer.printBitmap(headerBitmap);
        printer.lineFeed(1);

        const titleBitmap = converter.renderText('Sales Report', {
            fontSize: 28,
            bold: true,
            maxWidth: pixelWidth,
            align: 'center'
        });
        if (titleBitmap) printer.printBitmap(titleBitmap);
        printer.lineFeed(2);

        // Date range
        const fromDate = reportData.fromDate ? formatDate(reportData.fromDate) : '--';
        const toDate = reportData.toDate ? formatDate(reportData.toDate) : '--';
        const dateText = `From: ${fromDate}  To: ${toDate}`;
        const dateBitmap = converter.renderText(dateText, {
            fontSize: 20,
            maxWidth: pixelWidth,
            align: 'left'
        });
        if (dateBitmap) printer.printBitmap(dateBitmap);
        printer.lineFeed(2);

        printer.printSeparator(pixelWidth);
        printer.lineFeed(1);

        // ============ TABLE HEADER ============
        const headerColumns = [
            { text: 'No.', width: 8, align: 'left' },
            { text: 'Details', width: 25, align: 'left' },
            { text: 'Number', width: 25, align: 'center' },
            { text: 'Qty', width: 10, align: 'center' },
            { text: 'Rate', width: 15, align: 'right' },
            { text: 'Amount', width: 17, align: 'right' }
        ];

        const headerRowBitmap = converter.renderTableRow(headerColumns, {
            fontSize: 20,
            bold: true,
            maxWidth: pixelWidth
        });
        if (headerRowBitmap) printer.printBitmap(headerRowBitmap);
        printer.lineFeed(1);

        printer.printSeparator(pixelWidth);
        printer.lineFeed(1);

        // Group by invoice
        const invoiceGroups = {};
        salesItems.forEach(item => {
            if (item.invoice_number) {
                if (!invoiceGroups[item.invoice_number]) {
                    invoiceGroups[item.invoice_number] = [];
                }
                invoiceGroups[item.invoice_number].push(item);
            }
        });

        let grandTotalQty = 0;
        let grandTotalAmount = 0;

        // Print each invoice group
        const invoiceNumbers = Object.keys(invoiceGroups).sort((a, b) => Number(a) - Number(b));

        invoiceNumbers.forEach(invoiceNo => {
            const items = invoiceGroups[invoiceNo];

            // Invoice header
            const invHeaderBitmap = converter.renderText(`Invoice No: ${invoiceNo}`, {
                fontSize: 20,
                bold: true,
                maxWidth: pixelWidth,
                align: 'left'
            });
            if (invHeaderBitmap) printer.printBitmap(invHeaderBitmap);
            printer.lineFeed(1);

            // Print items
            items.forEach((item, index) => {
                const productName = str(item.product_name || '').substring(0, 15);
                const desc = str(item.desc || '-').substring(0, 15);
                const qty = Number(item.qty) || 0;
                const rate = Number(item.unit_price) || 0;
                const amount = Number(item.total) || (qty * rate);

                grandTotalQty += qty;
                grandTotalAmount += amount;

                const rowColumns = [
                    { text: `${index + 1}.`, width: 8, align: 'left' },
                    { text: productName, width: 25, align: 'left' },
                    { text: desc, width: 25, align: 'center' },
                    { text: String(qty), width: 10, align: 'center' },
                    { text: rate.toFixed(2), width: 15, align: 'right' },
                    { text: amount.toFixed(2), width: 17, align: 'right' }
                ];

                const rowBitmap = converter.renderTableRow(rowColumns, {
                    fontSize: 18,
                    maxWidth: pixelWidth
                });
                if (rowBitmap) printer.printBitmap(rowBitmap);
                printer.lineFeed(1);
            });

            printer.lineFeed(1);
        });

        // ============ TOTALS ============
        printer.printSeparator(pixelWidth);
        printer.lineFeed(1);

        const totalAmount = reportData.summary?.total_amount || grandTotalAmount;
        const totalQty = reportData.summary?.total_quantity || grandTotalQty;

        const totalColumns = [
            { text: 'Total', width: 58, align: 'left' },
            { text: String(totalQty), width: 10, align: 'center' },
            { text: '', width: 15, align: 'right' },
            { text: totalAmount.toFixed(2), width: 17, align: 'right' }
        ];

        const totalRowBitmap = converter.renderTableRow(totalColumns, {
            fontSize: 22,
            bold: true,
            maxWidth: pixelWidth
        });
        if (totalRowBitmap) printer.printBitmap(totalRowBitmap);
        printer.lineFeed(1);

        printer.printSeparator(pixelWidth);
        printer.lineFeed(2);

        // Footer
        const footerBitmap = converter.renderText('Thank You', {
            fontSize: 24,
            bold: true,
            maxWidth: pixelWidth,
            align: 'center'
        });
        if (footerBitmap) printer.printBitmap(footerBitmap);

        printer.lineFeed(3);
        printer.cmd(CMD.CUT);

        const result = printer.getBytes();
        console.log('[salesReportFormatter] Generated', result.length, 'bytes with custom font');
        return result;

    } catch (error) {
        console.error('[salesReportFormatter] Error:', error);
        const printer = new BitmapPrinter();
        printer.cmd(CMD.INIT);
        printer.cmd(CMD.CUT);
        return printer.getBytes();
    }
};

export default {
    formatLotteryReceiptWithFont,
    formatSalesReceiptWithFont,
    formatSalesReportReceiptWithFont,
    FontManager,
    TextToBitmapConverter,
    BitmapPrinter,
};