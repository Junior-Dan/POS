export class KraEtimsService {
  static generateCuInvoiceNumber(receiptNo) {
    const numericPart = receiptNo.replace(/[^0-9]/g, '');
    return `KRA2026CU${numericPart}NBI`;
  }

  static generateQrPayload(sale) {
    return `KRA|P051234567Z|${sale.receiptNo}|${sale.total}|${sale.tax}|${sale.timestamp}`;
  }

  static transmitInvoice(sale) {
    return {
      status: "ACCEPTED",
      cuInvoiceNo: this.generateCuInvoiceNumber(sale.receiptNo),
      timestamp: new Date().toISOString()
    };
  }
}
