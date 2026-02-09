# Bluetooth Printer Module

This module provides Bluetooth thermal printer support for the Lottery App.

## Features

- **BLE (Bluetooth Low Energy)**: Works on both Android and iOS
- **Classic Bluetooth**: Works on Android only (SPP protocol)
- **Auto-reconnect**: Saved printer configuration for quick printing
- **ESC/POS Support**: Full ESC/POS command support for thermal printers

## Usage

### Basic Printing Flow

```javascript
import PrinterService from '../printer/PrinterService';
import { formatSalesReceipt } from '../printer/lotteryReceiptFormatter';

// 1. Get saved printer
const savedPrinter = await PrinterService.getSavedPrinter();

// 2. Connect to printer
const connection = await PrinterService.connectToPrinter(savedPrinter);

// 3. Format receipt
const receiptBytes = formatSalesReceipt({
    username: 'John Doe',
    invoiceNo: 'INV-001',
    cartItems: [
        { product_name: 'Lucky Draw', desc: '1234', qty: 2, price: 50 },
    ],
}, '80'); // '80' for 80mm paper, '58' for 58mm

// 4. Send to printer
await PrinterService.sendRawToPrinter(connection, receiptBytes);

// 5. Disconnect
await PrinterService.disconnectPrinter(connection);
```

### Scanning for Printers

```javascript
// Scan for all printers (BLE + Classic)
await PrinterService.scanAllPrinters((device) => {
    console.log('Found printer:', device.name, device.type);
}, 10000); // 10 second scan duration
```

### Saving a Printer

```javascript
// Save printer for future use
await PrinterService.savePrinter(printerDevice);

// Get saved printer
const printer = await PrinterService.getSavedPrinter();

// Remove saved printer
await PrinterService.removeSavedPrinter();
```

## Receipt Format

The lottery receipt follows this layout:

```
------------------------------------------------
User: John Doe
Invoice No: 1       Time:10:30AM - 09/02/2026
Time Slot: 10:00 AM
Category: Morning Lottery
------------------------------------------------
No.    Product              Desc    Qty    Price
------------------------------------------------
1.     Lucky Draw            1234    2    100.00
2.     Mega Jackpot Special  5678    1    100.00
       Edition
3.     Daily Win             9012    5    100.00
------------------------------------------------
Total                                8    300.00
------------------------------------------------
            Thank you - Visit Again
```

## Files

- `PrinterService.js` - Bluetooth connection management
- `lotteryReceiptFormatter.js` - ESC/POS receipt formatting
- `index.js` - Module exports

## Dependencies

Make sure these packages are installed:

```json
{
  "react-native-ble-plx": "^3.5.0",
  "react-native-bluetooth-classic": "^1.73.0-rc.17",
  "@react-native-async-storage/async-storage": "^1.23.1"
}
```

## Permissions

### Android

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### iOS

Add to `Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to thermal printers</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app uses Bluetooth to connect to thermal printers</string>
```

## Supported Printers

The module works with most ESC/POS compatible thermal printers including:

- Generic 80mm/58mm Bluetooth thermal printers
- TVS printers
- EPSON TM series
- MUNBYN printers
- And most other ESC/POS compatible printers

## Troubleshooting

1. **Printer not found**: Make sure the printer is turned on and in pairing mode
2. **Connection failed**: Try forgetting the device from phone Bluetooth settings and re-pair
3. **Print quality issues**: Check paper size setting (80mm vs 58mm)
4. **Garbled text**: Printer may not fully support ESC/POS commands
