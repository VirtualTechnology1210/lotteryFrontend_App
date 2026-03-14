/**
 * CPCL Receipt Formatter for TVS BLP 370 Label Printer
 *
 * Printer Settings:
 *   - Print Width : 576 dots  (80mm @ 200 DPI)
 *   - Font used   : CPCL Font 4  (16 × 28 dots / character)
 *   - Usable dots : 556  (576 − 10 left margin − 10 right margin)
 *   - Max chars   : ≈ 34 chars across usable width
 *
 * Column layout for 6-column table (dots):
 *   No.     :   10  (2 chars  → 32 dots)
 *   Details :   45  (9 chars  → 144 dots)
 *   Number  :  195  (9 chars  → 144 dots)
 *   Qty     :  345  (3 chars  → 48 dots)
 *   Rate    :  400  (5 chars  → 80 dots)
 *   Amount  :  485  (5 chars  → 80 dots, ends ≈ 565)
 *
 * CPCL Commands:
 *   ! {offset} {xDPI} {yDPI} {height} {qty}
 *   PAGE-WIDTH {dots}
 *   CENTER / LEFT / RIGHT
 *   SETBOLD 1 / SETBOLD 0
 *   SETMAG {w} {h}
 *   TEXT {font} {rotation} {x} {y} {data}
 *   LINE {x1} {y1} {x2} {y2} {thickness}
 *   FORM
 *   PRINT
 */

// ─── Utilities ────────────────────────────────────────────────────────────────

const str = (val) => (val === null || val === undefined) ? '' : String(val);

const formatDate = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return str(date); }
};

const formatTime = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        let h = d.getHours();
        const m = d.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    } catch (e) { return str(date); }
};

const wrapText = (text, maxWidth) => {
    const words = str(text).split(' ');
    const lines = [];
    let currentLine = '';
    words.forEach(word => {
        if ((currentLine + ' ' + word).trim().length <= maxWidth) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            if (word.length > maxWidth) {
                while (word.length > maxWidth) {
                    lines.push(word.substring(0, maxWidth));
                    word = word.substring(maxWidth);
                }
            }
            currentLine = word;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : [''];
};

const getDescLines = (descText, maxPairs = 2) => {
    const text = str(descText);
    if (!text || text === '-') return ['-'];
    if (!text.includes(',')) return [wrapText(text, 9)[0] || '-'];
    const parts = text.split(',').map(p => p.trim()).filter(p => p);
    const lines = [];
    for (let i = 0; i < parts.length; i += maxPairs) {
        let line = '';
        for (let j = 0; j < maxPairs && (i + j) < parts.length; j++) {
            if (line) line += ',';
            line += parts[i + j];
        }
        lines.push(line);
    }
    return lines;
};

// ─── Printer Configuration ────────────────────────────────────────────────────

/**
 * All measurements in dots.
 * Print width set to 576 in printer — 80 mm @ 200 DPI.
 * Font 4: 16 dots wide × 28 dots tall per character.
 */
const CFG = {
    PRINT_WIDTH: 576,
    MARGIN_L: 10,
    MARGIN_R: 10,
    USABLE: 556,   // 576 - 10 - 10

    FONT: '4',   // CPCL Font 4 (16×28)
    ROT: '0',   // rotation 0 = normal

    CHAR_W: 16,    // character width in dots
    CHAR_H: 28,    // character height in dots

    LINE_H: 42,    // normal body line height (28 + 14 gap)
    LINE_H_BOLD: 46,    // bold / header line height

    // Max label height before auto-pagination (dots).
    // TVS BLP 370 buffer overflows around ~1600 dots; keep safe margin.
    MAX_LABEL_H: 1400,

    // ── Table column X-positions (dots) ──────────────────────────────────────
    // Total usable: 556 dots  |  Font 4: 16 dots/char
    //
    //  Col       X     MaxChars   Dots used
    //  No.       10    2          32
    //  Details   45    9          144   → ends at 189
    //  Number   195    9          144   → ends at 339
    //  Qty      345    3          48    → ends at 393
    //  Rate     400    5          80    → ends at 480
    //  Amount   486    5+         ≤ 90  → ends at 566  ✓
    COL_NO: 10,
    COL_DETAILS: 45,
    COL_NUMBER: 195,
    COL_QTY: 345,
    COL_RATE: 400,
    COL_AMOUNT: 486,
};

// ─── Builder Class ────────────────────────────────────────────────────────────

class CPCLBuilder {
    constructor() {
        this.entries = [];   // structured entries for auto-pagination
        this.y = 0;
    }

    /**
     * Append a raw CPCL command (state command like SETBOLD, CENTER, etc.)
     * Stored with the current Y so pagination can assign it to the right page.
     */
    cmd(line) {
        this.entries.push({ type: 'raw', content: line, y: this.y });
    }

    /** Advance Y without printing anything */
    gap(dots) { this.y += dots; }

    // ── Text helpers ──────────────────────────────────────────────────────────

    /** Print text at an absolute X position, then advance Y by lineHeight */
    text(x, txt, lineH = CFG.LINE_H) {
        this.entries.push({
            type: 'text', font: CFG.FONT, rot: CFG.ROT,
            x, y: this.y, text: String(txt),
        });
        this.y += lineH;
    }

    /** Print text without advancing Y (for same-line multi-column rows) */
    textInline(x, txt) {
        this.entries.push({
            type: 'text', font: CFG.FONT, rot: CFG.ROT,
            x, y: this.y, text: String(txt),
        });
    }

    /** Centered text, then advance Y */
    center(txt, lineH = CFG.LINE_H) {
        this.cmd('CENTER');
        this.entries.push({
            type: 'text', font: CFG.FONT, rot: CFG.ROT,
            x: 0, y: this.y, text: String(txt),
        });
        this.cmd('LEFT');
        this.y += lineH;
    }

    /** Bold centered text, then advance Y */
    centerBold(txt, lineH = CFG.LINE_H_BOLD) {
        this.cmd('SETBOLD 1');
        this.center(txt, lineH);
        this.cmd('SETBOLD 0');
    }

    /** Bold left-aligned text at X, then advance Y */
    bold(x, txt, lineH = CFG.LINE_H_BOLD) {
        this.cmd('SETBOLD 1');
        this.entries.push({
            type: 'text', font: CFG.FONT, rot: CFG.ROT,
            x, y: this.y, text: String(txt),
        });
        this.cmd('SETBOLD 0');
        this.y += lineH;
    }

    // ── Separator ─────────────────────────────────────────────────────────────

    /** Solid horizontal line across usable width */
    line(thickness = 2) {
        const x1 = CFG.MARGIN_L;
        const x2 = CFG.PRINT_WIDTH - CFG.MARGIN_R;
        this.entries.push({
            type: 'line', x1, y1: this.y, x2, y2: this.y, thickness,
        });
        this.y += thickness + 5;
    }

    // ── Table row ─────────────────────────────────────────────────────────────

    /**
     * Print one table row.  Pass '' to skip a column.
     * Does NOT advance Y — call gap(CFG.LINE_H) after a logical row.
     */
    rowCols(no, details, number, qty, rate, amount) {
        if (no) this.textInline(CFG.COL_NO, no);
        if (details) this.textInline(CFG.COL_DETAILS, details);
        if (number) this.textInline(CFG.COL_NUMBER, number);
        if (qty) this.textInline(CFG.COL_QTY, qty);
        if (rate) this.textInline(CFG.COL_RATE, rate);
        if (amount) this.textInline(CFG.COL_AMOUNT, amount);
    }

    /** Bold table row */
    rowColsBold(no, details, number, qty, rate, amount) {
        this.cmd('SETBOLD 1');
        this.rowCols(no, details, number, qty, rate, amount);
        this.cmd('SETBOLD 0');
    }

    // ── Split line (left + right on same Y) ───────────────────────────────────

    /**
     * Two pieces of text on the same line (left-aligned + right-aligned).
     * Advances Y after printing.
     */
    splitLine(leftTxt, rightTxt, bold = false, lineH = CFG.LINE_H) {
        const rightX = CFG.PRINT_WIDTH - CFG.MARGIN_R - (rightTxt.length * CFG.CHAR_W);
        if (bold) this.cmd('SETBOLD 1');
        this.textInline(CFG.MARGIN_L, leftTxt);
        this.textInline(Math.max(CFG.MARGIN_L, rightX), rightTxt);
        if (bold) this.cmd('SETBOLD 0');
        this.y += lineH;
    }

    // ── Finalize ──────────────────────────────────────────────────────────────

    /**
     * Render a single CPCL label from a list of entries.
     * @param {Array} entries - structured entries
     * @param {number} yOffset - Y offset to subtract (for pagination)
     * @param {number} pageH - total label height
     * @param {boolean} restoreBold - whether to start with SETBOLD 1
     * @param {string} restoreAlign - alignment to restore ('LEFT' or 'CENTER')
     * @returns {string} CPCL command block
     */
    _renderPage(entries, yOffset, pageH, restoreBold, restoreAlign) {
        let out = `! 0 200 200 ${pageH} 1\r\n`;
        out += `PAGE-WIDTH ${CFG.PRINT_WIDTH}\r\n`;

        // Restore formatting state from previous page
        if (restoreBold) out += 'SETBOLD 1\r\n';
        if (restoreAlign !== 'LEFT') out += restoreAlign + '\r\n';

        for (const entry of entries) {
            if (entry.type === 'text') {
                const adjY = entry.y - yOffset;
                out += `TEXT ${entry.font} ${entry.rot} ${entry.x} ${adjY} ${entry.text}\r\n`;
            } else if (entry.type === 'line') {
                const adjY1 = entry.y1 - yOffset;
                const adjY2 = entry.y2 - yOffset;
                out += `LINE ${entry.x1} ${adjY1} ${entry.x2} ${adjY2} ${entry.thickness}\r\n`;
            } else {
                // raw command (SETBOLD, CENTER, LEFT, SETMAG, etc.)
                out += entry.content + '\r\n';
            }
        }

        out += 'FORM\r\n';
        out += 'PRINT\r\n';
        return out;
    }

    /** Return complete CPCL command string (auto-paginates for large content) */
    build() {
        const totalH = this.y + 50;   // 50-dot bottom padding / paper feed
        const MAX_H = CFG.MAX_LABEL_H;

        // ── Single page: fits in one label ────────────────────────────────────
        if (totalH <= MAX_H) {
            return this._renderPage(this.entries, 0, totalH, false, 'LEFT');
        }

        // ── Multi-page: split entries across labels ───────────────────────────
        const numPages = Math.ceil(totalH / MAX_H);
        const pages = [];
        for (let i = 0; i < numPages; i++) pages.push([]);

        // Assign each entry to a page based on its Y position
        for (const entry of this.entries) {
            let entryY;
            if (entry.type === 'text') entryY = entry.y;
            else if (entry.type === 'line') entryY = entry.y1;
            else entryY = entry.y;   // raw commands use stored Y

            const pageIdx = Math.min(Math.floor(entryY / MAX_H), numPages - 1);
            pages[pageIdx].push(entry);
        }

        // Build each page, tracking formatting state across pages
        let out = '';
        let prevBold = false;
        let prevAlign = 'LEFT';

        for (let p = 0; p < numPages; p++) {
            const yOffset = p * MAX_H;
            const pageCmds = pages[p];

            // Calculate this page's actual max Y (for label height)
            let pageMaxY = 0;
            for (const entry of pageCmds) {
                if (entry.type === 'text') {
                    pageMaxY = Math.max(pageMaxY, (entry.y - yOffset) + CFG.LINE_H);
                } else if (entry.type === 'line') {
                    pageMaxY = Math.max(pageMaxY, (entry.y1 - yOffset) + entry.thickness + 5);
                }
            }
            if (pageMaxY === 0) pageMaxY = MAX_H;
            const pageH = pageMaxY + 50;

            out += this._renderPage(pageCmds, yOffset, pageH, prevBold, prevAlign);

            // Track formatting state at end of this page for next page
            for (const entry of pageCmds) {
                if (entry.type === 'raw') {
                    if (entry.content === 'SETBOLD 1') prevBold = true;
                    else if (entry.content === 'SETBOLD 0') prevBold = false;
                    else if (entry.content === 'CENTER') prevAlign = 'CENTER';
                    else if (entry.content === 'LEFT') prevAlign = 'LEFT';
                }
            }
        }

        return out;
    }

    /** Return CPCL command as Uint8Array (ASCII / UTF-8) */
    buildBytes() {
        const s = this.build();
        const bytes = [];
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            if (c < 128) bytes.push(c);
            else if (c < 2048) { bytes.push(192 | (c >> 6)); bytes.push(128 | (c & 63)); }
            else { bytes.push(224 | (c >> 12)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)); }
        }
        const numPages = Math.ceil((this.y + 50) / CFG.MAX_LABEL_H);
        console.log(`[cpclReceiptFormatter] Generated ${bytes.length} bytes, ${numPages} page(s)`);
        return new Uint8Array(bytes);
    }
}

// ─── Shared: Table header row ─────────────────────────────────────────────────

function addTableHeader(b) {
    b.line(2);
    b.rowColsBold('No.', 'Details', 'Number', 'Qty', 'Rate', 'Amt');
    b.y += CFG.LINE_H_BOLD;
    b.line(2);
}

// ─── Shared: Item rows ────────────────────────────────────────────────────────

/**
 * Render item rows into builder.
 * Returns { totalQty, totalAmount }.
 */
function addItemRows(b, items) {
    let totalQty = 0;
    let totalAmount = 0;

    items.forEach((item, index) => {
        const productName = str(item.productName || item.product_name || '');
        const desc = str(item.desc || '-');
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const lineTotal = qty * price;

        totalQty += qty;
        totalAmount += lineTotal;

        const nameLines = wrapText(productName, 9);  // 9 chars × 16 = 144 dots
        const descMaxPairs = 1;
        const descLines = getDescLines(desc, descMaxPairs);
        const rows = Math.max(nameLines.length, descLines.length);

        const qtyStr = String(qty);
        const rateStr = String(Math.round(price));
        const amtStr = String(Math.round(lineTotal));

        for (let i = 0; i < rows; i++) {
            const rowNo = i === 0 ? `${index + 1}.` : '';
            const rowName = nameLines[i] || '';
            const rowDesc = descLines[i] || '';
            const rowQty = i === 0 ? qtyStr : '';
            const rowRate = i === 0 ? rateStr : '';
            const rowAmt = i === 0 ? amtStr : '';

            b.rowCols(rowNo, rowName, rowDesc, rowQty, rowRate, rowAmt);
            b.y += CFG.LINE_H;
        }
    });

    return { totalQty, totalAmount };
}

// ─── Shared: Totals row ───────────────────────────────────────────────────────

function addTotalsRow(b, totalQty, totalAmount) {
    b.line(2);
    b.rowColsBold('', 'Total', '', String(totalQty), '', String(Math.round(totalAmount)));
    b.y += CFG.LINE_H_BOLD;
    b.line(2);
}

// ─── Shared: Footer ───────────────────────────────────────────────────────────

function addFooter(b) {
    b.gap(16);
    b.centerBold('** THANK YOU. VISIT AGAIN **', CFG.LINE_H_BOLD);
    b.gap(50);
}

// ─── Error bytes helper ───────────────────────────────────────────────────────

function errorBytes(label) {
    const s = `! 0 200 200 200 1\r\nCENTER\r\nTEXT 4 0 0 50 ${label}\r\nFORM\r\nPRINT\r\n`;
    const bytes = [];
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    return new Uint8Array(bytes);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Format lottery sales receipt (CPCL) for TVS BLP 370.
 *
 * @param {Object} receiptData
 * @param {string} receiptData.username
 * @param {string} receiptData.invoiceNo
 * @param {Date|string} receiptData.billTime
 * @param {Date|string} receiptData.date
 * @param {string=} receiptData.timeSlot
 * @param {string=} receiptData.categoryName
 * @param {Array}  receiptData.items  — [{ productName, desc, qty, price }]
 * @returns {Uint8Array}
 */
export const formatLotteryReceipt = (receiptData, _width = '80') => {
    try {
        const items = Array.isArray(receiptData?.items) ? receiptData.items : [];
        const b = new CPCLBuilder();

        // ── Header ──────────────────────────────────────────────────────────
        b.gap(12);
        b.centerBold('======== D K ========', CFG.LINE_H_BOLD);
        b.gap(10);

        // ── User info ────────────────────────────────────────────────────────
        b.bold(CFG.MARGIN_L, `User: ${str(receiptData.username)}`);

        // Bill No  (left)   |   Time - Date  (right)
        const billNoTxt = `Bill No: ${str(receiptData.invoiceNo)}`;
        const timeTxt = `${formatTime(receiptData.billTime)} - ${formatDate(receiptData.date)}`;
        b.splitLine(billNoTxt, timeTxt, true, CFG.LINE_H);

        if (receiptData.timeSlot) {
            b.bold(CFG.MARGIN_L, `Show Time: ${str(receiptData.timeSlot)}`);
        }
        if (receiptData.categoryName) {
            b.bold(CFG.MARGIN_L, `Category: ${str(receiptData.categoryName)}`);
        }
        b.gap(10);

        // ── Table ────────────────────────────────────────────────────────────
        addTableHeader(b);
        const { totalQty, totalAmount } = addItemRows(b, items);
        addTotalsRow(b, totalQty, totalAmount);

        // ── Footer ───────────────────────────────────────────────────────────
        addFooter(b);

        return b.buildBytes();

    } catch (e) {
        console.error('[cpclReceiptFormatter] formatLotteryReceipt error:', e);
        return errorBytes('PRINT ERROR');
    }
};

/**
 * Format multi-item sales receipt from SalesScreen cart items.
 *
 * @param {Object} data
 * @param {string} data.username
 * @param {string} data.invoiceNo
 * @param {Array}  data.cartItems
 * @returns {Uint8Array}
 */
export const formatSalesReceipt = (data, width = '80') => {
    const now = new Date();

    const categories = {};
    const timeSlotSet = new Set();

    (data.cartItems || []).forEach(item => {
        const cat = item.category_name || 'Other';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);

        let slots = item.time_slots;
        if (slots) {
            if (typeof slots === 'string') {
                try { slots = JSON.parse(slots); } catch { slots = [slots]; }
            }
            if (Array.isArray(slots)) slots.forEach(s => s && timeSlotSet.add(s));
        }
    });

    const categoryDisplay = Object.keys(categories).join(', ') || null;
    const timeSlotDisplay = Array.from(timeSlotSet).join(', ') || data.timeSlot || null;

    const items = (data.cartItems || []).map(item => ({
        productName: item.product_name,
        desc: item.desc || '-',
        qty: item.qty,
        price: item.price,
        box: item.box,
    }));

    return formatLotteryReceipt({
        username: data.username,
        invoiceNo: data.invoiceNo,
        billTime: now,
        date: now,
        timeSlot: timeSlotDisplay,
        categoryName: categoryDisplay,
        items,
    }, width);
};

/**
 * Format sales report receipt (CPCL) for TVS BLP 370.
 *
 * @param {Object} reportData
 * @param {string} reportData.fromDate
 * @param {string} reportData.toDate
 * @param {Array}  reportData.salesItems
 * @param {Object} reportData.summary  — { total_quantity, total_amount }
 * @returns {Uint8Array}
 */
export const formatSalesReportReceipt = (reportData, _width = '80') => {
    try {
        const salesItems = Array.isArray(reportData?.salesItems) ? reportData.salesItems : [];
        const b = new CPCLBuilder();

        // ── Header ──────────────────────────────────────────────────────────
        b.gap(12);
        b.centerBold('======== D K ========', CFG.LINE_H_BOLD);
        b.gap(10);
        b.centerBold('Sales Report', CFG.LINE_H_BOLD);
        b.gap(10);

        // ── Date range ───────────────────────────────────────────────────────
        const fromTxt = `From: ${reportData.fromDate ? formatDate(reportData.fromDate) : '--'}`;
        const toTxt = `To: ${reportData.toDate ? formatDate(reportData.toDate) : '--'}`;
        b.splitLine(fromTxt, toTxt, true, CFG.LINE_H);
        b.gap(10);

        // ── Table ────────────────────────────────────────────────────────────
        addTableHeader(b);

        // Group by invoice number
        const invoiceMap = {};
        const noInvoice = [];

        salesItems.forEach(item => {
            if (item.invoice_number) {
                if (!invoiceMap[item.invoice_number]) invoiceMap[item.invoice_number] = [];
                invoiceMap[item.invoice_number].push(item);
            } else {
                noInvoice.push(item);
            }
        });

        let grandQty = 0;
        let grandAmount = 0;

        const invoiceNos = Object.keys(invoiceMap).sort((a, z) => Number(a) - Number(z));

        invoiceNos.forEach(invNo => {
            const grpItems = invoiceMap[invNo];
            b.bold(CFG.MARGIN_L, `  Invoice: ${invNo}`, CFG.LINE_H);

            const mapped = grpItems.map(item => ({
                productName: item.product_name || item.product_code || '',
                desc: item.desc || '-',
                qty: Number(item.qty) || 0,
                price: Number(item.unit_price) || 0,
                box: item.box,
            }));

            const { totalQty, totalAmount } = addItemRows(b, mapped);
            grandQty += totalQty;
            grandAmount += totalAmount;
        });

        if (noInvoice.length > 0) {
            b.bold(CFG.MARGIN_L, '  Other Sales', CFG.LINE_H);
            const mapped = noInvoice.map(item => ({
                productName: item.product_name || item.product_code || '',
                desc: item.desc || '-',
                qty: Number(item.qty) || 0,
                price: Number(item.unit_price) || 0,
                box: item.box,
            }));
            const { totalQty, totalAmount } = addItemRows(b, mapped);
            grandQty += totalQty;
            grandAmount += totalAmount;
        }

        const finalQty = reportData.summary?.total_quantity ?? grandQty;
        const finalAmount = Math.round(reportData.summary?.total_amount ?? grandAmount);

        addTotalsRow(b, finalQty, finalAmount);

        // ── Footer ───────────────────────────────────────────────────────────
        addFooter(b);

        return b.buildBytes();

    } catch (e) {
        console.error('[cpclReceiptFormatter] formatSalesReportReceipt error:', e);
        return errorBytes('REPORT ERROR');
    }
};

/**
 * Format rate summary report receipt (CPCL) for TVS BLP 370.
 *
 * @param {Object} reportData
 * @param {string} reportData.fromDate
 * @param {string} reportData.toDate
 * @param {Array}  reportData.reportItems — [{ rate, total_quantity, total_amount }]
 * @param {Object} reportData.summary    — { total_quantity, total_amount }
 * @returns {Uint8Array}
 */
export const formatRateSummaryReportReceipt = (reportData, _width = '80') => {
    try {
        const reportItems = Array.isArray(reportData?.reportItems) ? reportData.reportItems : [];
        const b = new CPCLBuilder();

        // ── Header ──────────────────────────────────────────────────────────
        b.gap(12);
        b.centerBold('======== D K ========', CFG.LINE_H_BOLD);
        b.gap(10);
        b.centerBold('Rate Summary Report', CFG.LINE_H_BOLD);
        b.gap(10);

        if (reportData.username) {
            b.bold(CFG.MARGIN_L, `User: ${str(reportData.username)}`);
            b.gap(8);
        }

        // ── Date range ───────────────────────────────────────────────────────
        const fromTxt = `From: ${reportData.fromDate ? formatDate(reportData.fromDate) : '--'}`;
        const toTxt = `To: ${reportData.toDate ? formatDate(reportData.toDate) : '--'}`;
        b.splitLine(fromTxt, toTxt, true, CFG.LINE_H);
        b.gap(10);

        // ── Table Header ──────────────────────────────────────────────────────
        b.line(2);
        b.cmd('SETBOLD 1');
        // Custom 3-column layout positions for Rate Summary
        const X_RATE = 10;
        const X_QTY = 345;
        const X_AMOUNT = 486;

        b.textInline(X_RATE, 'Rate');
        b.textInline(X_QTY, 'Qty');
        b.textInline(X_AMOUNT, 'Amount');
        b.y += CFG.LINE_H_BOLD;
        b.cmd('SETBOLD 0');
        b.line(2);

        // ── Rows ─────────────────────────────────────────────────────────────
        reportItems.forEach(item => {
            const rateStr = String(Math.round(item.rate));
            const qtyStr = String(item.total_quantity);
            const amountStr = String(Math.round(item.total_amount));

            b.textInline(X_RATE, rateStr);
            b.textInline(X_QTY, qtyStr);
            b.textInline(X_AMOUNT, amountStr);
            b.y += CFG.LINE_H;
        });

        // ── Totals ───────────────────────────────────────────────────────────
        if (reportData.summary) {
            b.line(2);
            b.cmd('SETBOLD 1');
            b.textInline(X_RATE, 'TOTAL');
            b.textInline(X_QTY, String(reportData.summary.total_quantity));
            b.textInline(X_AMOUNT, String(Math.round(reportData.summary.total_amount)));
            b.y += CFG.LINE_H_BOLD;
            b.cmd('SETBOLD 0');
            b.line(2);
        }

        // ── Footer ───────────────────────────────────────────────────────────
        addFooter(b);

        return b.buildBytes();

    } catch (e) {
        console.error('[cpclReceiptFormatter] formatRateSummaryReportReceipt error:', e);
        return errorBytes('REPORT ERROR');
    }
};

/**
 * Format winning summary receipt (CPCL) for TVS BLP 370.
 *
 * @param {Object} data
 * @param {string} data.fromDate
 * @param {string} data.toDate
 * @param {Object} data.summary — {
 *   total_sales_amount, total_winning_amount, total_balance,
 *   user_wise: [{ user_name, total_sales, total_winning, balance }]
 * }
 * @returns {Uint8Array}
 */
export const formatWinningSummaryReceipt = (data, _width = '80') => {
    try {
        const summary = data?.summary || {};
        const b = new CPCLBuilder();

        // Column positions for 3-column layout
        const X_LABEL = 10;
        const X_VALUE = 300;

        // ── Header ──────────────────────────────────────────────────────────
        b.gap(12);
        b.centerBold('======== D K ========', CFG.LINE_H_BOLD);
        b.gap(10);
        b.centerBold('Winning Summary', CFG.LINE_H_BOLD);
        b.gap(10);

        // ── Date range ───────────────────────────────────────────────────────
        const fromTxt = `From: ${data.fromDate ? formatDate(data.fromDate) : '--'}`;
        const toTxt = `To: ${data.toDate ? formatDate(data.toDate) : '--'}`;
        b.splitLine(fromTxt, toTxt, true, CFG.LINE_H);
        b.gap(10);

        // ── Overall Summary ─────────────────────────────────────────────────
        b.line(2);
        b.centerBold('Overall Summary', CFG.LINE_H_BOLD);
        b.line(1);
        b.gap(4);

        b.splitLine('Total Sales', String(Math.round(summary.total_sales_amount || 0)), false, CFG.LINE_H);
        b.splitLine('Total Winning', String(Math.round(summary.total_winning_amount || 0)), false, CFG.LINE_H);
        b.line(1);
        b.splitLine('Balance', String(Math.round(summary.total_balance || 0)), true, CFG.LINE_H);
        b.line(2);
        b.gap(10);

        // ── User-wise Split ──────────────────────────────────────────────────
        const users = Array.isArray(summary.user_wise) ? summary.user_wise : [];
        if (users.length > 0) {
            b.centerBold('User-wise Split', CFG.LINE_H_BOLD);
            b.line(1);
            b.gap(4);

            // Table header
            b.cmd('SETBOLD 1');
            b.textInline(X_LABEL, 'User');
            b.textInline(X_VALUE, 'Sales/Winning/Balance');
            b.y += CFG.LINE_H_BOLD;
            b.cmd('SETBOLD 0');
            b.line(1);

            users.forEach(user => {
                const name = str(user.user_name || '?');
                b.bold(X_LABEL, name, CFG.LINE_H);

                b.splitLine('  Sales', String(Math.round(user.total_sales || 0)), false, CFG.LINE_H);
                b.splitLine('  Winning', String(Math.round(user.total_winning || 0)), false, CFG.LINE_H);
                b.splitLine('  Balance', String(Math.round(user.balance || 0)), true, CFG.LINE_H);
                b.line(1);
            });
        }

        // ── Footer ───────────────────────────────────────────────────────────
        addFooter(b);

        return b.buildBytes();

    } catch (e) {
        console.error('[cpclReceiptFormatter] formatWinningSummaryReceipt error:', e);
        return errorBytes('REPORT ERROR');
    }
};

/** Convert bytes to hex string (debugging) */
export const bytesToHex = (bytes, limit = 200) =>
    Array.from(bytes.slice(0, limit))
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');

export default {
    formatLotteryReceipt,
    formatSalesReceipt,
    formatSalesReportReceipt,
    formatRateSummaryReportReceipt,
    formatWinningSummaryReceipt,
    bytesToHex,
};
