import React, { useState, useEffect, useCallback, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Alert,
    Platform,
    TouchableOpacity,
    ToastAndroid,
    Linking
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { reportService } from '../services/reportService';
import PrinterService from '../printer/PrinterService';
import { formatSalesReportReceipt } from '../printer/cpclReceiptFormatter';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';

// Memoized Report Item for FlatList performance
const ReportItem = memo(({ item, formatDateTime, navigation }) => {
    const [expanded, setExpanded] = useState(false);

    const handleEditSingle = (saleItem) => {
        navigation.navigate('SaleEdit', {
            saleId: saleItem.id,
            saleData: saleItem,
            isMultiple: false,
        });
    };

    const handleEditGroup = () => {
        navigation.navigate('SaleEdit', {
            isMultiple: true,
            salesItems: item.items,
            groupTotal: item.total,
        });
    };

    if (item.isGroup) {
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setExpanded(!expanded)}
                style={styles.reportCard}
            >
                <View style={styles.reportHeader}>
                    <View style={styles.headerLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <MaterialCommunityIcons name="basket-outline" size={20} color="#3a48c2" style={{ marginRight: 6 }} />
                            <Text style={styles.productName}>{item.items.length} - Items </Text>
                            <Text style={{ fontSize: 9, color: '#000000ff', textTransform: 'uppercase' }}>       Sold By   :   </Text>
                            <Text style={{ fontSize: 12, color: '#3a48c2', fontWeight: '600' }}>{item.created_by}</Text>
                        </View>
                        {item.invoice_number && (
                            <View style={styles.invoiceBadge}>
                                <MaterialCommunityIcons name="receipt" size={20} color="#3a48c2" />
                                <Text style={styles.invoiceText}>Invoice: {item.invoice_number}</Text>
                            </View>
                        )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.totalAmount}>₹{Math.round(item.total)}</Text>
                    </View>
                </View>

                {expanded && (
                    <View style={styles.groupDetails}>
                        <View style={styles.divider} />
                        {item.items.map((subItem, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={styles.subItemRow}
                                onPress={() => handleEditSingle(subItem)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                        <View style={{ backgroundColor: '#000000ff', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#ffffffff' }}>{idx + 1}</Text>
                                        </View>
                                        {subItem.category_name && (
                                            <View style={[styles.codeBadge, { backgroundColor: '#E8F5E9', paddingHorizontal: 6, paddingVertical: 1, marginLeft: 0 }]}>
                                                <Text style={[styles.codeText, { color: '#2E7D32', fontSize: 10 }]}>{subItem.category_name}</Text>
                                            </View>
                                        )}
                                        {subItem.product_code && (
                                            <View style={[styles.codeBadge, { paddingHorizontal: 6, paddingVertical: 1 }]}>
                                                <Text style={[styles.codeText, { fontSize: 10 }]}>{subItem.product_code}</Text>
                                            </View>
                                        )}

                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 4 }}>
                                        <View>
                                            <Text style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase' }}>Price x Qty</Text>
                                            <Text style={{ fontSize: 12, color: '#333', fontWeight: '600' }}>
                                                ₹{subItem.unit_price ? Math.round(subItem.unit_price) : '0'} x {subItem.qty}
                                            </Text>
                                        </View>
                                    </View>

                                    {subItem.desc ? (
                                        <Text style={[styles.subItemDesc, { fontWeight: 'bold', color: '#333' }]}>Lottery No   :    {subItem.desc}</Text>
                                    ) : null}
                                </View>
                                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase', marginBottom: 2 }}>Item Total</Text>
                                    <Text style={styles.subItemTotal}>₹{Math.round(parseFloat(subItem.total))}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={styles.reportFooter}>
                    <View style={styles.metaRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color="#888" />
                        <Text style={styles.footerText}>{formatDateTime(item.created_at)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {/* <TouchableOpacity
                            onPress={handleEditGroup}
                            style={styles.editIconButton}
                        >
                            <MaterialCommunityIcons name="pencil-outline" size={18} color="#3a48c2" />
                        </TouchableOpacity> */}

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#3a48c2', marginRight: 4 }}>
                                {expanded ? 'Hide Details' : 'View Details'}
                            </Text>
                            <MaterialCommunityIcons
                                name={expanded ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#3a48c2"
                            />
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
                <View style={styles.headerLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {item.category_name && (
                            <View style={[styles.codeBadge, { backgroundColor: '#E8F5E9', marginLeft: 4 }]}>
                                <Text style={[styles.codeText, { color: '#2E7D32' }]}>{item.category_name}</Text>
                            </View>
                        )}
                        {item.product_code && (
                            <View style={styles.codeBadge}>
                                <Text style={styles.codeText}>{item.product_code}</Text>
                            </View>
                        )}
                        {item.invoice_number && (
                            <View style={styles.invoiceBadge}>
                                <MaterialCommunityIcons name="receipt" size={12} color="#3a48c2" />
                                <Text style={styles.invoiceText}>
                                    Invoice: {item.invoice_number}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.totalAmount}>₹{Math.round(parseFloat(item.total))}</Text>
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.reportDetails}>
                <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Unit Price</Text>
                        <Text style={styles.detailValue}>₹{item.unit_price ? Math.round(item.unit_price) : '0'}</Text>
                    </View>
                    <View style={[styles.detailItem, { alignItems: 'center' }]}>
                        <Text style={styles.detailLabel}>Quantity</Text>
                        <Text style={styles.detailValue}>{item.qty}</Text>
                    </View>
                    <View style={[styles.detailItem, { alignItems: 'flex-end' }]}>
                        <Text style={styles.detailLabel}>SOLD BY</Text>
                        <Text style={styles.userText}>{item.created_by || 'Unknown'}</Text>
                    </View>
                </View>

                {item.desc && (
                    <View style={styles.descContainer}>
                        <Text style={styles.descLabel}>Lottery Number:</Text>
                        <Text style={styles.descText}>{item.desc}</Text>
                    </View>
                )}
            </View>

            <View style={styles.reportFooter}>
                <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#888" />
                    <Text style={styles.footerText}>{formatDateTime(item.created_at)}</Text>
                </View>
                {/* <TouchableOpacity
                    onPress={() => handleEditSingle(item)}
                    style={styles.editIconButton}
                >
                    <MaterialCommunityIcons name="pencil-outline" size={18} color="#3a48c2" />
                </TouchableOpacity> */}
            </View>
        </View>
    );
});

const ReportResultScreen = ({ navigation, route }) => {
    const { filters } = route.params || {};
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState([]);
    const [rawSalesData, setRawSalesData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    const fetchReport = useCallback(async () => {
        // Only show loading on initial load or empty data
        if (reportData.length === 0) setIsLoading(true);

        try {
            const response = await reportService.getSalesReport({
                ...filters,
                limit: 100 // Get more records to allow grouping
            });

            if (response && response.data) {
                const { report, summary: apiSummary } = response.data;
                const sales = report || [];

                // Store raw flat sales data for printing
                setRawSalesData(sales);

                // Group transactions by invoice number
                const groupTransactions = (transactions) => {
                    if (!transactions || transactions.length === 0) return [];

                    const invoiceGroups = {};
                    const noInvoiceItems = [];

                    transactions.forEach(item => {
                        if (item.invoice_number) {
                            if (!invoiceGroups[item.invoice_number]) {
                                invoiceGroups[item.invoice_number] = {
                                    invoice_number: item.invoice_number,
                                    created_at: item.created_at,
                                    created_by: item.created_by,
                                    items: [],
                                    total: 0,
                                    isGroup: false,
                                    id: `invoice-${item.invoice_number}`,
                                    category_name: item.category_name
                                };
                            }
                            invoiceGroups[item.invoice_number].items.push(item);
                            invoiceGroups[item.invoice_number].total += parseFloat(item.total || 0);
                        } else {
                            noInvoiceItems.push({
                                ...item,
                                created_by: item.created_by,
                                isGroup: false,
                                items: [item],
                                total: parseFloat(item.total || 0),
                                id: item.id
                            });
                        }
                    });

                    // Mark groups with multiple items
                    Object.values(invoiceGroups).forEach(group => {
                        if (group.items.length > 1) {
                            group.isGroup = true;
                            group.id = `group-${group.invoice_number}`;
                            // If grouped, take the category from the first item if not already set
                            if (!group.category_name && group.items[0]) {
                                group.category_name = group.items[0].category_name;
                            }
                        } else {
                            const singleItem = group.items[0];
                            Object.assign(group, singleItem);
                            group.total = parseFloat(singleItem.total);
                        }
                    });

                    const allGroups = [...Object.values(invoiceGroups), ...noInvoiceItems];
                    allGroups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                    return allGroups;
                };

                setReportData(groupTransactions(report));
                setSummary(response.data.summary || null);
            }
        } catch (error) {
            console.error('Fetch report error:', error);
            Alert.alert('Error', 'Failed to load report data');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    // Auto-refresh when screen comes into focus (after editing a sale)
    useFocusEffect(
        useCallback(() => {
            fetchReport();
        }, [fetchReport])
    );

    // Process the actual printing
    const processPrintReport = async () => {
        setIsPrinting(true);
        try {
            const receiptBytes = formatSalesReportReceipt({
                fromDate: filters?.start_date || null,
                toDate: filters?.end_date || null,
                salesItems: rawSalesData,
                summary: summary,
            }, '80');

            await PrinterService.printWithPersistentConnection(receiptBytes);

            if (Platform.OS === 'android') {
                ToastAndroid.show('Report printed successfully!', ToastAndroid.SHORT);
            }
        } catch (error) {
            console.error('[Print Report] Error:', error);
            const msg = error.message || 'Failed to print report';

            if (msg.includes('No printer configured')) {
                Alert.alert(
                    'No Printer',
                    'No printer configured. Would you like to set up a printer?',
                    [
                        { text: 'Later', style: 'cancel' },
                        { text: 'Setup', onPress: () => navigation.navigate('PrinterSettings') }
                    ]
                );
            } else if (Platform.OS === 'android') {
                ToastAndroid.show(`Print: ${msg}`, ToastAndroid.LONG);
            }
        } finally {
            setIsPrinting(false);
        }
    };

    // Print the full sales report with confirmation
    const handlePrintReport = () => {
        if (rawSalesData.length === 0) {
            Alert.alert('No Data', 'No sales data to print.');
            return;
        }

        Alert.alert(
            'Print Report',
            `Are you sure you want to print the full report?\n(${rawSalesData.length} items)`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Print',
                    onPress: processPrintReport
                }
            ]
        );
    };

    // Generate A4 PDF and share via WhatsApp
    const handleWhatsAppShare = async () => {
        if (rawSalesData.length === 0) {
            Alert.alert('No Data', 'No sales data to share.');
            return;
        }

        setIsSharing(true);
        try {
            // Format lottery numbers: one per line
            const formatLotteryNumbers = (desc) => {
                if (!desc || desc === '-') return '-';
                return desc.split(',').map(n => n.trim()).filter(Boolean).join('<br>');
            };

            // Build table rows from rawSalesData
            const tableRows = rawSalesData.map((item, index) => {
                const productName = item.product_name || item.product_code || '-';
                const lotteryDisplay = formatLotteryNumbers(item.desc);
                const qty = item.qty || 0;
                const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fd';
                return `
                    <tr style="background-color: ${bgColor};">
                        <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #555;">${index + 1}</td>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #555; font-weight: 500;">${productName}</td>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 14px; color: #1a1a1a; font-weight: 600; letter-spacing: 1px;">${lotteryDisplay}</td>
                        <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; color: #333; text-align: center; font-weight: 600;">${qty}</td>
                    </tr>
                `;
            }).join('');

            const totalQty = rawSalesData.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
            const totalEntries = rawSalesData.length;

            const dateRange = filters?.start_date && filters?.end_date
                ? `${new Date(filters.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — ${new Date(filters.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

            const htmlContent = `
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        @page { size: A4; margin: 15mm; }
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            color: #222;
                            margin: 0;
                            padding: 0;
                        }
                    </style>
                </head>
                <body>
                    <div style="background: linear-gradient(135deg, #3a48c2, #192f6a); color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;">
                        <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">Sales Report</h1>
                        <p style="margin: 0; font-size: 14px; opacity: 0.85;">${dateRange}</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; background: #fff; border: 1px solid #f0f0f5; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; font-size: 15px;">
                        <span>Total Entries: <strong style="color: #3a48c2;">${totalEntries}</strong></span>
                        <span>Total Qty: <strong style="color: #3a48c2;">${totalQty}</strong></span>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <div style="background: #3a48c2; padding: 12px 18px; border-radius: 8px 8px 0 0; margin-bottom: 0; page-break-after: avoid;">
                            <span style="font-size: 15px; font-weight: 700; color: #fff;">Sales Details</span>
                            <span style="float: right; font-size: 13px; color: #fff; font-weight: 600;">${totalEntries} items | Qty: ${totalQty}</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border-radius: 0 0 8px 8px; overflow: hidden; border: 1px solid #eee;">
                            <thead>
                                <tr style="background: #f0f2ff;">
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: left;">#</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: left;">Product</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: left;">Lottery No</th>
                                    <th style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #3a48c2; text-transform: uppercase; text-align: center;">Qty</th>
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </body>
                </html>
            `;

            const pdfOptions = {
                html: htmlContent,
                fileName: `Sales_Report_${Date.now()}`,
                directory: 'Documents',
                base64: false,
                height: 842,
                width: 595,
            };

            const pdf = await RNHTMLtoPDF.convert(pdfOptions);

            if (pdf.filePath) {
                await Share.open({
                    url: `file://${pdf.filePath}`,
                    type: 'application/pdf',
                    social: Share.Social.WHATSAPP,
                    title: 'Sales Report',
                    message: `Sales Report (${dateRange})`,
                });
            }
        } catch (error) {
            // User cancelled share — ignore dismiss errors
            if (error?.message !== 'User did not share' && !error?.message?.includes('dismiss')) {
                console.error('[WhatsApp Share] Error:', error);
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Failed to share report', ToastAndroid.SHORT);
                }
            }
        } finally {
            setIsSharing(false);
        }
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderSummary = () => {
        if (!summary) return null;
        return (
            <View style={styles.summaryContainer}>
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <MaterialCommunityIcons name="receipt" size={24} color="#3a48c2" />
                            <Text style={styles.summaryValue}>{summary.total_records}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>Total Sales</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <MaterialCommunityIcons name="package-variant" size={24} color="#15803d" />
                            <Text style={styles.summaryValue}>{summary.total_quantity}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>Total Qtys</Text>
                    </View>
                    <View style={[styles.summaryCard, styles.summaryCardWide]}>
                        <View style={styles.summaryRow}>
                            <MaterialCommunityIcons name="cash-multiple" size={24} color="#c2410c" />
                            <Text style={styles.summaryValue}>₹{Math.round(summary.total_amount)}</Text>
                        </View>
                        <Text style={styles.summaryLabel}>Total Amount</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderItem = useCallback(({ item }) => (
        <ReportItem item={item} formatDateTime={formatDateTime} navigation={navigation} />
    ), [navigation]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#3a48c2', '#2a38a0', '#192f6a']}
                style={styles.headerBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Decorative Elements */}
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />

                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Sales Report Result</Text>
                    <TouchableOpacity
                        onPress={handlePrintReport}
                        style={styles.printButton}
                        disabled={isPrinting || isLoading || rawSalesData.length === 0}
                    >
                        {isPrinting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <MaterialCommunityIcons name="printer" size={22} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3a48c2" />
                    <Text style={styles.loadingText}>Generating Report...</Text>
                </View>
            ) : (
                <FlatList
                    data={reportData}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    ListHeaderComponent={renderSummary}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="file-alert-outline" size={60} color="#ddd" />
                            <Text style={styles.emptyText}>No sales found</Text>
                            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
                        </View>
                    }
                />
            )}

            {/* WhatsApp Floating Action Button */}
            <TouchableOpacity
                style={styles.whatsappFab}
                onPress={handleWhatsAppShare}
                activeOpacity={0.8}
                disabled={isSharing || isLoading || rawSalesData.length === 0}
            >
                {isSharing ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <MaterialCommunityIcons name="whatsapp" size={28} color="#fff" />
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    headerBackground: {
        paddingTop: Platform.OS === 'android' ? 20 : 20,
        paddingBottom: 26,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden',
        zIndex: 1,
    },
    decorativeCircle1: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        top: -50,
        right: -50,
    },
    decorativeCircle2: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        top: 40,
        left: -40,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    backButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        padding: 10,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    addButtonPlaceholder: {
        width: 44,
        height: 44,
    },
    printButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        padding: 10,
        borderRadius: 52,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 16,
    },
    listContainer: {
        padding: 16,
    },
    summaryContainer: {
        marginBottom: 10,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    summaryCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 12,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    summaryCardWide: {
        minWidth: '100%',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
        gap: 6,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    summaryLabel: {
        fontSize: 11,
        color: '#666',
    },
    reportCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerLeft: {
        flex: 1,
        marginRight: 10,
    },
    productName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    codeBadge: {
        backgroundColor: '#EEF0FF',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    codeText: {
        fontSize: 12,
        color: '#3a48c2',
        fontWeight: '600',
    },
    invoiceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(58, 72, 194, 0.08)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    invoiceText: {
        fontSize: 12,
        color: '#3a48c2',
        fontWeight: '700',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15803d',
    },
    divider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 12,
    },
    reportDetails: {
        gap: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailItem: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    descContainer: {
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
    },
    descLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 2,
    },
    descText: {
        fontSize: 13,
        color: '#000000ff',
        fontStyle: 'italic',
        fontWeight: '700',
    },
    metaInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f5f5f5',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#666',
    },
    userText: {
        fontWeight: '600',
        color: '#3a48c2',
    },
    reportFooter: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#888',
        marginLeft: 4,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#999',
        marginTop: 15,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#bbb',
        marginTop: 5,
    },
    groupDetails: {
        backgroundColor: '#F8F9FD',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
    },
    subItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    subItemMeta: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    subItemTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#15803d',
    },
    subItemDesc: {
        fontSize: 11,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 2,
    },
    editIconButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(58, 72, 194, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    editAllText: {
        fontSize: 12,
        color: '#3a48c2',
        fontWeight: '600',
    },
    whatsappFab: {
        position: 'absolute',
        bottom: 24,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#25D366',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        zIndex: 999,
    },
});

export default ReportResultScreen;
