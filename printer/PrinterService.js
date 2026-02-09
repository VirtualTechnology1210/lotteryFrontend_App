/**
 * Bluetooth Printer Service for Lottery App
 * 
 * Provides functions to:
 * 1. Scan for Bluetooth printers (BLE and Classic)
 * 2. Connect to a selected printer
 * 3. Send raw ESC/POS bytes to the printer
 * 4. Disconnect from the printer
 * 
 * Platform Support:
 * - Android: Both BLE and Classic Bluetooth (SPP)
 * - iOS: BLE only (Classic Bluetooth requires MFi certification)
 * 
 * Dependencies:
 * - react-native-ble-plx (for BLE)
 * - react-native-bluetooth-classic (for Classic Bluetooth on Android)
 */

import { BleManager } from 'react-native-ble-plx';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

// Storage key for saved printer
const SAVED_PRINTER_KEY = '@lottery_saved_printer';

// BLE Manager instance (singleton)
let bleManager = null;

// Persistent printer connection (singleton)
let activeConnection = null;
let activePrinterInfo = null;

// Common printer name patterns to filter devices
const PRINTER_NAME_PATTERNS = [
    'printer',
    'thermal',
    'bluetooth',
    'pos',
    'spp',
    'rpp',
    'escpos',
];

/**
 * Initialize BLE Manager
 */
const initBleManager = () => {
    if (!bleManager) {
        bleManager = new BleManager();
    }
    return bleManager;
};

/**
 * Request Android Bluetooth permissions
 * Required for Android 12+ (API 31+)
 */
export const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;

        try {
            if (apiLevel >= 31) {
                // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
                // These permissions exist only on Android 12+
                const permissionsToRequest = [];

                // Safely check if permissions exist before adding
                if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
                    permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
                }
                if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
                    permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
                }
                if (PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
                    permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                }

                if (permissionsToRequest.length === 0) {
                    console.log('[Permissions] No permissions to request');
                    return true;
                }

                console.log('[Permissions] Requesting:', permissionsToRequest);
                const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);
                console.log('[Permissions] Result:', granted);

                // Check if critical permissions are granted
                const scanGranted = !PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN ||
                    granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === 'granted';
                const connectGranted = !PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT ||
                    granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === 'granted';

                return scanGranted && connectGranted;
            } else {
                // For Android < 12, only location permission is needed at runtime
                // BLUETOOTH and BLUETOOTH_ADMIN are manifest-only permissions
                const permissionsToRequest = [];

                if (PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
                    permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                }
                if (PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION) {
                    permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
                }

                if (permissionsToRequest.length === 0) {
                    console.log('[Permissions] No permissions to request for older Android');
                    return true;
                }

                console.log('[Permissions] Requesting (older Android):', permissionsToRequest);
                const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);
                console.log('[Permissions] Result:', granted);

                // Check if at least one location permission is granted
                const fineLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted';
                const coarseLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted';

                return fineLocationGranted || coarseLocationGranted;
            }
        } catch (err) {
            console.error('Bluetooth permission error:', err);
            return false;
        }
    }

    // iOS doesn't need runtime permissions for BLE
    return true;
};

/**
 * Check if device name matches printer patterns
 */
const isPrinterDevice = (deviceName) => {
    if (!deviceName) return false;

    const nameLower = deviceName.toLowerCase();
    return PRINTER_NAME_PATTERNS.some(pattern => nameLower.includes(pattern));
};

/**
 * Scan for BLE printers
 * @param {function} onDeviceFound - Callback when a printer is found
 * @param {number} scanDuration - Scan duration in milliseconds (default 10s)
 * @returns {Promise<void>}
 */
export const scanBLEPrinters = async (onDeviceFound, scanDuration = 10000) => {
    const manager = initBleManager();

    // Check Bluetooth state
    const state = await manager.state();
    if (state !== 'PoweredOn') {
        throw new Error('Bluetooth is not enabled. Please turn on Bluetooth.');
    }

    const foundDevices = new Set();

    console.log('[BLE] Starting scan for ALL BLE devices...');

    // Start scanning - scan ALL devices (null filters)
    manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
            console.error('[BLE] Scan error:', error);
            return;
        }

        // Show ALL BLE devices with names
        if (device && device.name && !foundDevices.has(device.id)) {
            console.log('[BLE] Found BLE device:', device.name, device.id);
            foundDevices.add(device.id);

            onDeviceFound({
                id: device.id,
                name: device.name,
                type: 'BLE',
                rssi: device.rssi,
                device: device, // Store raw device for connection
            });
        }
    });

    // Stop scan after duration
    setTimeout(() => {
        stopBLEScan();
        console.log('[BLE] Scan stopped. Found', foundDevices.size, 'BLE devices');
    }, scanDuration);
};

/**
 * Stop any active BLE scanning
 */
export const stopBLEScan = () => {
    if (bleManager) {
        bleManager.stopDeviceScan();
        console.log('[BLE] Manual scan stop triggered');
    }
};

/**
 * Scan for Classic Bluetooth printers (Android only)
 * @param {function} onDeviceFound - Callback when a printer is found
 * @returns {Promise<void>}
 */
export const scanClassicPrinters = async (onDeviceFound) => {
    if (Platform.OS !== 'android') {
        console.log('[Classic] Classic Bluetooth not supported on iOS');
        return;
    }

    try {
        // Check if Bluetooth is enabled first
        let isEnabled = false;
        try {
            isEnabled = await RNBluetoothClassic.isBluetoothEnabled();
        } catch (e) {
            console.log('[Classic] Could not check Bluetooth state:', e.message);
        }

        if (!isEnabled) {
            console.log('[Classic] Bluetooth adapter not enabled, skipping Classic scan');
            return;
        }

        // Get paired devices - show ALL paired devices, not just printers
        const paired = await RNBluetoothClassic.getBondedDevices();
        console.log('[Classic] Found', paired.length, 'paired devices');

        paired.forEach(device => {
            // Show all paired devices that have a name
            if (device.name) {
                console.log('[Classic] Found paired device:', device.name, device.address);
                onDeviceFound({
                    id: device.address,
                    name: device.name,
                    type: 'Classic',
                    address: device.address,
                    device: device,
                });
            }
        });

        // Skip discovery as it can be slow and unreliable
        // Paired devices are sufficient for most use cases
        console.log('[Classic] Scan complete');
    } catch (error) {
        // Don't throw - just log and continue with BLE scan
        console.log('[Classic] Scan skipped:', error.message);
    }
};

/**
 * Scan for all printers (BLE + Classic)
 * @param {function} onDeviceFound - Callback when a printer is found
 * @param {number} scanDuration - BLE scan duration in ms
 * @returns {Promise<void>}
 */
export const scanAllPrinters = async (onDeviceFound, scanDuration = 10000) => {
    // Request permissions first
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
        throw new Error('Bluetooth permissions not granted');
    }

    // Scan both BLE and Classic simultaneously
    const promises = [
        scanBLEPrinters(onDeviceFound, scanDuration),
    ];

    if (Platform.OS === 'android') {
        promises.push(scanClassicPrinters(onDeviceFound));
    }

    try {
        await Promise.allSettled(promises);
    } catch (error) {
        console.error('[Scan] Error during scan:', error);
        throw error;
    }
};

/**
 * Connect to a BLE printer with retry logic
 * @param {Object} printerDevice - Device object from scan
 * @returns {Promise<Object>} Connection object with write function
 */
const connectBLE = async (printerDevice, retryCount = 0) => {
    const manager = initBleManager();
    const MAX_RETRIES = 3;

    // Ensure scan is stopped before connecting
    stopBLEScan();

    console.log('[BLE] Connecting to', printerDevice.name, printerDevice.id, `(attempt ${retryCount + 1}/${MAX_RETRIES})`);

    try {
        // Check if device is already connected
        let isConnected = false;
        try {
            isConnected = await manager.isDeviceConnected(printerDevice.id);
        } catch (e) {
            // Ignore
        }

        if (isConnected) {
            console.log('[BLE] Device already connected, disconnecting first...');
            try {
                await manager.cancelDeviceConnection(printerDevice.id);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                // Ignore
            }
        }

        // Wait before connecting
        const waitTime = retryCount > 0 ? 1000 + (retryCount * 500) : 500;
        console.log('[BLE] Waiting', waitTime, 'ms before connecting...');
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Connect to device
        const device = await manager.connectToDevice(printerDevice.id, {
            timeout: 15000,
            autoConnect: false,
        });

        console.log('[BLE] Connected, waiting for stability...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('[BLE] Discovering services...');
        await device.discoverAllServicesAndCharacteristics();

        // Find writable characteristic
        const services = await device.services();

        let writeCharacteristic = null;

        for (const service of services) {
            const characteristics = await service.characteristics();

            for (const char of characteristics) {
                // Look for writable characteristic
                if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
                    console.log('[BLE] Found writable characteristic:', char.uuid);
                    writeCharacteristic = char;
                    break;
                }
            }

            if (writeCharacteristic) break;
        }

        if (!writeCharacteristic) {
            throw new Error('No writable characteristic found on printer');
        }

        console.log('[BLE] Connection successful!');

        return {
            type: 'BLE',
            device: device,
            characteristic: writeCharacteristic,
            disconnect: async () => {
                try {
                    await device.cancelConnection();
                    console.log('[BLE] Disconnected');
                } catch (err) {
                    console.error('[BLE] Disconnect error:', err);
                }
            },
        };
    } catch (error) {
        console.error('[BLE] Connection error:', error);

        // Retry logic
        if (retryCount < 2) {
            console.log('[BLE] Retrying connection...');
            return connectBLE(printerDevice, retryCount + 1);
        }

        throw error;
    }
};

/**
 * Connect to a Classic Bluetooth printer (for TVS, etc.)
 * @param {Object} printerDevice - Device object from scan
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} Connection object with write function
 */
const connectClassic = async (printerDevice, retryCount = 0) => {
    if (Platform.OS !== 'android') {
        throw new Error('Classic Bluetooth not supported on iOS');
    }

    const MAX_RETRIES = 3;
    console.log('[Classic] Connecting to', printerDevice.name, printerDevice.id, `(attempt ${retryCount + 1}/${MAX_RETRIES})`);

    try {
        // Check if Bluetooth is enabled
        const isEnabled = await RNBluetoothClassic.isBluetoothEnabled();
        if (!isEnabled) {
            throw new Error('Bluetooth is not enabled. Please turn on Bluetooth.');
        }

        // Check if device is already connected
        let device = null;
        try {
            const isConnected = await RNBluetoothClassic.isDeviceConnected(printerDevice.id);
            if (isConnected) {
                console.log('[Classic] Device already connected, getting reference...');
                device = await RNBluetoothClassic.getConnectedDevice(printerDevice.id);
            }
        } catch (e) {
            console.log('[Classic] Not already connected, will connect fresh');
        }

        // If not already connected, connect now
        if (!device) {
            // Try to disconnect first (in case of stale connection)
            try {
                await RNBluetoothClassic.disconnectFromDevice(printerDevice.id);
                console.log('[Classic] Disconnected stale connection');
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                // Ignore - device might not be connected
            }

            // Wait a bit before connecting (helps with some printers)
            const waitTime = retryCount > 0 ? 1000 * retryCount : 300;
            console.log('[Classic] Waiting', waitTime, 'ms before connecting...');
            await new Promise(resolve => setTimeout(resolve, waitTime));

            // Connect to device
            console.log('[Classic] Initiating connection...');
            device = await RNBluetoothClassic.connectToDevice(printerDevice.id, {
                connectorType: 'rfcomm',
                delimiter: '\n',
                charset: 'utf-8',
            });
        }

        // Verify connection by checking if we can access the device
        if (!device) {
            throw new Error('Connection returned null device');
        }

        console.log('[Classic] Connected successfully to', device.name || device.address);

        return {
            type: 'Classic',
            device: device,
            disconnect: async () => {
                try {
                    await RNBluetoothClassic.disconnectFromDevice(printerDevice.id);
                    console.log('[Classic] Disconnected');
                } catch (err) {
                    console.error('[Classic] Disconnect error:', err);
                }
            },
        };
    } catch (error) {
        console.error('[Classic] Connection error:', error.message);

        // Retry logic
        if (retryCount < MAX_RETRIES - 1) {
            console.log('[Classic] Retrying connection...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            return connectClassic(printerDevice, retryCount + 1);
        }

        throw new Error(`Classic Bluetooth connection failed: ${error.message}`);
    }
};

/**
 * Connect to a printer
 * @param {Object} printerDevice - Device object from scan
 * @returns {Promise<Object>} Connection handle
 */
export const connectToPrinter = async (printerDevice) => {
    if (printerDevice.type === 'BLE') {
        return await connectBLE(printerDevice);
    } else if (printerDevice.type === 'Classic') {
        return await connectClassic(printerDevice);
    } else {
        throw new Error('Unknown printer type');
    }
};

/**
 * Send raw bytes to BLE printer
 * @param {Object} connection - Connection object from connectToPrinter
 * @param {Uint8Array} bytes - Raw bytes to send
 * @param {number} chunkSize - Max bytes per write (default 20)
 * @returns {Promise<boolean>} Success
 */
const sendBLEBytes = async (connection, bytes, chunkSize = 20) => {
    const { device, characteristic } = connection;

    console.log('[BLE] Sending', bytes.length, 'bytes to printer');

    try {
        // Split into chunks to avoid MTU limitations
        const totalChunks = Math.ceil(bytes.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, bytes.length);
            const chunk = bytes.slice(start, end);

            // Convert to base64 using Buffer (btoa doesn't exist in React Native)
            const chunkBase64 = Buffer.from(chunk).toString('base64');

            // Write with or without response based on characteristic capabilities
            if (characteristic.isWritableWithResponse) {
                await characteristic.writeWithResponse(chunkBase64);
            } else {
                await characteristic.writeWithoutResponse(chunkBase64);
            }

            // Small delay between chunks to avoid overwhelming the printer
            if (i < totalChunks - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        console.log('[BLE] Sent all chunks successfully');
        return true;
    } catch (error) {
        console.error('[BLE] Send error:', error);
        throw error;
    }
};

/**
 * Send raw bytes to Classic printer
 * @param {Object} connection - Connection object from connectToPrinter
 * @param {Uint8Array} bytes - Raw bytes to send
 * @returns {Promise<boolean>} Success
 */
const sendClassicBytes = async (connection, bytes) => {
    const { device } = connection;

    console.log('[Classic] Sending', bytes.length, 'bytes to printer');

    try {
        // Convert Uint8Array to string for react-native-bluetooth-classic
        const dataString = String.fromCharCode.apply(null, bytes);

        const written = await device.write(dataString);

        console.log('[Classic] Sent', written ? 'successfully' : 'with errors');
        return written;
    } catch (error) {
        console.error('[Classic] Send error:', error);
        throw error;
    }
};

/**
 * Send raw bytes to printer with retry logic
 * @param {Object} connection - Connection object from connectToPrinter
 * @param {Uint8Array} bytes - Raw bytes to send
 * @param {number} maxRetries - Maximum retry attempts (default 2)
 * @returns {Promise<boolean>} Success
 */
export const sendRawToPrinter = async (connection, bytes, maxRetries = 2) => {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`[Print] Retry attempt ${attempt}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (connection.type === 'BLE') {
                await sendBLEBytes(connection, bytes);
            } else if (connection.type === 'Classic') {
                await sendClassicBytes(connection, bytes);
            } else {
                throw new Error('Unknown connection type');
            }

            console.log('[Print] Successfully sent print data');
            return true;
        } catch (error) {
            lastError = error;
            console.error(`[Print] Attempt ${attempt + 1} failed:`, error.message);
        }
    }

    throw new Error(`Failed to print after ${maxRetries + 1} attempts: ${lastError.message}`);
};

/**
 * Check if the active connection is still valid
 * @returns {Promise<boolean>} True if connected
 */
const isConnectionActive = async () => {
    if (!activeConnection || !activePrinterInfo) {
        return false;
    }

    try {
        if (activeConnection.type === 'BLE') {
            const manager = initBleManager();
            return await manager.isDeviceConnected(activePrinterInfo.id);
        } else if (activeConnection.type === 'Classic') {
            return await RNBluetoothClassic.isDeviceConnected(activePrinterInfo.id);
        }
    } catch (e) {
        console.log('[Printer] Connection check failed:', e.message);
        return false;
    }
    return false;
};

/**
 * Get existing connection or create a new one (persistent)
 * @returns {Promise<Object>} Connection object
 */
export const getOrCreateConnection = async () => {
    // Get saved printer
    const savedPrinter = await getSavedPrinter();
    if (!savedPrinter) {
        throw new Error('No printer configured. Please set up a printer first.');
    }

    // Check if we have an active connection to the same printer
    if (activeConnection && activePrinterInfo?.id === savedPrinter.id) {
        const isActive = await isConnectionActive();
        if (isActive) {
            console.log('[Printer] Reusing existing connection to', savedPrinter.name);
            return activeConnection;
        } else {
            console.log('[Printer] Previous connection lost, reconnecting...');
            activeConnection = null;
            activePrinterInfo = null;
        }
    }

    // Create new connection
    console.log('[Printer] Creating new persistent connection to', savedPrinter.name);
    const connection = await connectToPrinter(savedPrinter);

    // Store for reuse
    activeConnection = connection;
    activePrinterInfo = savedPrinter;

    return connection;
};

/**
 * Print receipt using persistent connection (preferred method)
 * @param {Uint8Array} bytes - Receipt bytes to print
 * @returns {Promise<boolean>} Success
 */
export const printWithPersistentConnection = async (bytes) => {
    const connection = await getOrCreateConnection();
    return await sendRawToPrinter(connection, bytes);
};

/**
 * Force disconnect from printer (use when changing printers or app closes)
 * @returns {Promise<void>}
 */
export const forceDisconnect = async () => {
    if (activeConnection && activeConnection.disconnect) {
        try {
            await activeConnection.disconnect();
            console.log('[Printer] Force disconnected');
        } catch (e) {
            console.log('[Printer] Force disconnect error:', e.message);
        }
    }
    activeConnection = null;
    activePrinterInfo = null;
};

/**
 * Disconnect from printer (deprecated - kept for backward compatibility)
 * Now a no-op to keep connection alive. Use forceDisconnect() to actually disconnect.
 * @param {Object} connection - Connection object from connectToPrinter
 * @returns {Promise<void>}
 */
export const disconnectPrinter = async (connection) => {
    // No-op: Keep connection alive for faster subsequent prints
    console.log('[Printer] Keeping connection alive for next print');
};

/**
 * Save printer to storage for auto-connect
 * @param {Object} printerDevice - Printer device object
 */
export const savePrinter = async (printerDevice) => {
    try {
        const printerData = {
            id: printerDevice.id,
            name: printerDevice.name,
            type: printerDevice.type,
            address: printerDevice.address,
        };
        await AsyncStorage.setItem(SAVED_PRINTER_KEY, JSON.stringify(printerData));
        console.log('[Printer] Saved printer:', printerData.name);
    } catch (error) {
        console.error('[Printer] Save error:', error);
    }
};

/**
 * Get saved printer from storage
 * @returns {Promise<Object|null>} Saved printer or null
 */
export const getSavedPrinter = async () => {
    try {
        const data = await AsyncStorage.getItem(SAVED_PRINTER_KEY);
        if (data) {
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error('[Printer] Get saved error:', error);
        return null;
    }
};

/**
 * Remove saved printer
 */
export const removeSavedPrinter = async () => {
    try {
        await AsyncStorage.removeItem(SAVED_PRINTER_KEY);
        console.log('[Printer] Removed saved printer');
    } catch (error) {
        console.error('[Printer] Remove error:', error);
    }
};

/**
 * Cleanup BLE manager (call when app unmounts)
 */
export const cleanup = () => {
    if (bleManager) {
        bleManager.destroy();
        bleManager = null;
    }
};

export default {
    requestBluetoothPermissions,
    scanAllPrinters,
    scanBLEPrinters,
    stopBLEScan,
    scanClassicPrinters,
    connectToPrinter,
    sendRawToPrinter,
    disconnectPrinter,
    savePrinter,
    getSavedPrinter,
    removeSavedPrinter,
    cleanup,
    // Persistent connection functions
    getOrCreateConnection,
    printWithPersistentConnection,
    forceDisconnect,
};
