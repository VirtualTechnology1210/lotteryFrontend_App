/**
 * Printer Module Index
 * 
 * Exports all printer-related utilities:
 * - PrinterService: Bluetooth connection and printing
 * - lotteryReceiptFormatter: ESC/POS receipt formatting (legacy)
 * - cpclReceiptFormatter: CPCL receipt formatting for TVS BLP 370
 */

export { default as PrinterService } from './PrinterService';

// ESC/POS formatters (legacy - kept for backward compatibility)
export {
    formatLotteryReceipt,
    formatSalesReceipt,
    formatSalesReportReceipt,
    bytesToHex
} from './lotteryReceiptFormatter';

// CPCL formatters (for TVS BLP 370 label printer)
export {
    formatLotteryReceipt as formatLotteryReceiptCPCL,
    formatSalesReceipt as formatSalesReceiptCPCL,
    formatSalesReportReceipt as formatSalesReportReceiptCPCL,
    bytesToHex as bytesToHexCPCL,
} from './cpclReceiptFormatter';

// Re-export all named exports from PrinterService
export {
    requestBluetoothPermissions,
    scanAllPrinters,
    scanBLEPrinters,
    scanClassicPrinters,
    connectToPrinter,
    sendRawToPrinter,
    disconnectPrinter,
    savePrinter,
    getSavedPrinter,
    removeSavedPrinter,
    cleanup,
} from './PrinterService';
