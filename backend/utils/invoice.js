const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.jpeg");
const PLUM = "#4A2140";
const GOLD = "#C6A05C";
const MUTED = "#6B3358";

function invoiceNumberFor(order) {
  const year = new Date(order.createdAt).getFullYear();
  const seq = (order.orderNumber || "").replace(/\D/g, "").slice(-4) || "0000";
  return `INV-${year}-${seq}`;
}

// Streams a PDF invoice for exactly ONE order directly to the given response. Contains only
// that order's own data (customer, items, totals) - never other customers, other orders, or
// site-wide revenue figures.
function streamInvoicePdf(order, res) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, 50, 45, { width: 60 });
  }
  doc
    .fillColor(PLUM)
    .fontSize(20)
    .text("SubhRa Crafts", 120, 50)
    .fontSize(9)
    .fillColor(GOLD)
    .text("HANDMADE WITH LOVE", 120, 74);

  doc
    .fillColor(PLUM)
    .fontSize(22)
    .text("INVOICE", 400, 50, { align: "right" });

  const invoiceNumber = invoiceNumberFor(order);
  doc
    .fontSize(9)
    .fillColor(MUTED)
    .text(`Invoice No: ${invoiceNumber}`, 400, 78, { align: "right" })
    .text(`Order ID: ${order.orderNumber}`, 400, 92, { align: "right" })
    .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`, 400, 106, { align: "right" });

  doc.moveTo(50, 135).lineTo(545, 135).strokeColor("#E5D0D9").stroke();

  let y = 150;
  doc.fillColor(PLUM).fontSize(11).text("Bill To", 50, y);
  y += 16;
  doc.fillColor("#333").fontSize(10);
  doc.text(order.user?.name || order.shippingAddress?.name || "-", 50, y); y += 14;
  doc.text(order.user?.email || "-", 50, y); y += 14;
  doc.text(order.shippingAddress?.phone || order.user?.phone || "-", 50, y); y += 14;
  const addr = order.shippingAddress;
  if (addr) {
    const addrLine = [addr.house, addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
    doc.text(addrLine, 50, y, { width: 250 });
    y += 28;
  }

  doc.fillColor(PLUM).fontSize(11).text("Payment", 350, 150);
  doc.fillColor("#333").fontSize(10);
  doc.text(`Status: ${(order.paymentStatus || "").toUpperCase()}`, 350, 166);
  doc.text(`Method: ${(order.paymentMethod || "").toUpperCase()}`, 350, 180);
  doc.text(`Payment Date: ${new Date(order.updatedAt).toLocaleDateString("en-IN")}`, 350, 194);

  y = Math.max(y, 214) + 20;

  const tableTop = y;
  doc.rect(50, tableTop, 495, 22).fill(PLUM);
  doc.fillColor("#fff").fontSize(10);
  doc.text("Item", 58, tableTop + 6);
  doc.text("Qty", 330, tableTop + 6, { width: 40, align: "right" });
  doc.text("Price", 380, tableTop + 6, { width: 70, align: "right" });
  doc.text("Total", 460, tableTop + 6, { width: 75, align: "right" });

  let rowY = tableTop + 22;
  order.items.forEach((item, i) => {
    const rowHeight = 24;
    if (i % 2 === 1) {
      doc.rect(50, rowY, 495, rowHeight).fill("#FBF6EF");
    }
    doc.fillColor("#333").fontSize(10);
    doc.text(item.name, 58, rowY + 6, { width: 260 });
    doc.text(String(item.quantity), 330, rowY + 6, { width: 40, align: "right" });
    doc.text(`Rs ${item.price}`, 380, rowY + 6, { width: 70, align: "right" });
    doc.text(`Rs ${item.price * item.quantity}`, 460, rowY + 6, { width: 75, align: "right" });
    rowY += rowHeight;
  });

  doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor("#E5D0D9").stroke();
  rowY += 12;

  const totalsX = 380;
  const addTotalRow = (label, value, bold = false) => {
    doc.fontSize(bold ? 12 : 10).fillColor(bold ? PLUM : "#333");
    doc.text(label, totalsX, rowY, { width: 70, align: "right" });
    doc.text(value, 460, rowY, { width: 75, align: "right" });
    rowY += bold ? 20 : 16;
  };

  addTotalRow("Subtotal:", `Rs ${order.itemsTotal}`);
  if (order.discount) addTotalRow("Discount:", `-Rs ${order.discount}`);
  addTotalRow("Shipping:", `Rs ${order.shippingFee}`);
  rowY += 4;
  doc.moveTo(totalsX, rowY).lineTo(545, rowY).strokeColor("#E5D0D9").stroke();
  rowY += 8;
  addTotalRow("Total Paid:", `Rs ${order.totalAmount}`, true);

  doc
    .fontSize(11)
    .fillColor(GOLD)
    .text("Thank you for shopping with SubhRa Crafts", 50, rowY + 40, { align: "center", width: 495 });

  doc.end();
}

module.exports = { streamInvoicePdf };
