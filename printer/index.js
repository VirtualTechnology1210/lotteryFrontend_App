/**
 * Printer Module Index
 * 
 * Exports all printer-related utilities:
 * - PrinterService: Bluetooth connection and printing
 * - lotteryReceiptFormatter: Receipt formatting for lottery sales
 */

export { default as PrinterService } from './PrinterService';
export {
    formatLotteryReceipt,
    formatSalesReceipt,
    bytesToHex
} from './lotteryReceiptFormatter';

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
