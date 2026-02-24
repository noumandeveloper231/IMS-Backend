import PDFDocument from "pdfkit";

/**
 * Generate invoice PDF with a modern, clean design.
 * @param {Object} res - Express response object
 * @param {Object} sale - Sale object (with customer and items populated)
 */
const generateInvoice = (res, sale) => {
  try {
    const doc = new PDFDocument({ margin: 50 });

    // Pipe PDF into response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=invoice-${sale.invoiceNo}.pdf`
    );
    doc.pipe(res);

    // Color Palette & Fonts
    const primaryColor = "#111827"; // Almost black for text
    const secondaryColor = "#4b5563"; // Dark gray for secondary text
    const accentColor = "#3b82f6"; // A nice blue for accents
    const lightGray = "#f3f4f6"; // Light gray for backgrounds

    doc.font("Helvetica");

    // ----- Header Section (Shop Info) -----
    // Use a larger font for the shop name and place it on the top left
    doc
      .fontSize(24)
      .fillColor(primaryColor)
      .text("Al Ramil Al Abyad", { align: "left" });

    doc
      .fontSize(10)
      .fillColor(secondaryColor)
      .text("Shop# 1, Industrial Area# 6 UAE Sharjah", { align: "left" })
      .moveDown(0.25);
    doc
      .text("Phone: +971 54 784 6521 | Email: info@ramil.ae", {
        align: "left",
      })
      .moveDown(2);

    // ----- Invoice Details & Customer Info -----
    // Use an accent color for the invoice title to make it stand out
    const invoiceDetailsY = doc.y;

    doc
      .fontSize(20)
      .fillColor(accentColor)
      .text("INVOICE", 50, invoiceDetailsY);
    doc
      .fontSize(10)
      .fillColor(primaryColor)
      .text(`Invoice No: ${sale.invoiceNo}`, 50, invoiceDetailsY + 25);
    doc
      .text(
        `Invoice Date: ${new Date(sale.createdAt).toLocaleDateString()}`,
        50,
        invoiceDetailsY + 40
      )
      .moveDown(2);

    // Align customer details to the right
    const customerDetailsX = 350;
    doc
      .fontSize(12)
      .fillColor(secondaryColor)
      .text("Bill To:", customerDetailsX, invoiceDetailsY)
      .moveDown(0.5);
    doc
      .fontSize(12)
      .fillColor(primaryColor)
      .text(`${sale.customer?.name || "N/A"}`, customerDetailsX);
    doc
      .fontSize(10)
      .fillColor(secondaryColor)
      .text(`${sale.customer?.phone || "N/A"}`, customerDetailsX);

    doc.moveDown(4);

    // ----- Table Section -----
    const tableTop = doc.y;
    const itemHeight = 30;

    // Table Header with a solid background and white text
    doc.rect(50, tableTop, 500, itemHeight).fill(primaryColor).stroke();
    doc
      .fontSize(12)
      .fillColor("white")
      .text("Product", 65, tableTop + 10)
      .text("Qty", 280, tableTop + 10, { width: 50, align: "center" })
      .text("Price", 370, tableTop + 10, { width: 50, align: "right" })
      .text("Total", 485, tableTop + 10, { width: 50, align: "right" });

    // Table Rows with alternating background colors
    let y = tableTop + itemHeight;
    let grandTotal = 0;

    sale.items.forEach((item, index) => {
      const product = item.product || {};
      const title = product.title || "Unknown Product";
      const price = item.price || product.salePrice || 0;
      const qty = item.quantity || 0;
      const total = qty * price;
      grandTotal += total;

      // Draw background color for alternating rows
      if (index % 2 === 0) {
        doc.rect(50, y, 500, itemHeight).fill(lightGray).stroke();
      }

      doc.fontSize(10).fillColor(primaryColor);
      doc
        .text(title, 65, y + 10)
        .text(qty.toString(), 280, y + 10, { width: 50, align: "center" })
        .text(`$${price.toFixed(2)}`, 370, y + 10, {
          width: 50,
          align: "right",
        })
        .text(`$${total.toFixed(2)}`, 485, y + 10, {
          width: 50,
          align: "right",
        });

      // Add a border below the row
      doc.rect(50, y, 500, itemHeight).stroke();

      y += itemHeight;
    });

    // Total section with bold font and accent color
    doc.moveDown();
    const totalY = doc.y;

    doc.fontSize(12).fillColor(primaryColor);
    doc.text("Grand Total:", 400, totalY, { align: "right" });
    doc
      .fontSize(14)
      .fillColor(accentColor)
      .font("Helvetica-Bold")
      .text(`$${grandTotal.toFixed(2)}`, 400, totalY + 20, {
        align: "right",
      });

    // ----- Footer -----
    doc
      .fontSize(10)
      .fillColor(secondaryColor)
      .text("Thank you for your purchase!", 50, doc.page.height - 50, {
        align: "center",
      });

    doc.end();
  } catch (err) {
    console.error("Error generating invoice:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  }
};

export default generateInvoice;

// // src/utils/generateInvoice.js
// import PDFDocument from "pdfkit";

// /**
//  * Generate invoice PDF
//  * @param {Object} res - Express response object
//  * @param {Object} sale - Sale object (with customer + items populated)
//  */
// const generateInvoice = (res, sale) => {
//   try {
//     const doc = new PDFDocument({ margin: 50 });

//     // Pipe PDF into response
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `inline; filename=invoice-${sale.invoiceNo}.pdf`
//     );
//     doc.pipe(res);

//     // Colors
//     const tableTop = 230;
//     const rowHeight = 30;

//     // ----- Shop Header -----
//     doc
//       .fontSize(22)
//       .fillColor("#1f2937") // dark gray
//       .text("My Shop", { align: "center" });

//     doc.moveDown(0.5);
//     doc
//       .fontSize(10)
//       .fillColor("#4b5563")
//       .text("123 Main Street, Karachi, Pakistan", { align: "center" });
//     doc.text("Phone: +92 300 1234567 | Email: info@myshop.com", {
//       align: "center",
//     });

//     doc.moveDown(1.5);

//     // ----- Invoice Header -----
//     doc
//       .fontSize(16)
//       .fillColor("#111827")
//       .text("Invoice", { align: "center", underline: true });
//     doc.moveDown();

//     doc.fontSize(12).fillColor("black");
//     doc.text(`Invoice No: ${sale.invoiceNo}`, 50, 150);
//     doc.text(`Date: ${new Date(sale.createdAt).toLocaleDateString()}`, 50, 170);

//     // ----- Customer Info -----
//     doc
//       .fontSize(14)
//       .fillColor("#111827")
//       .text("Bill To:", 50, 200, { underline: true });
//     doc.fontSize(12).fillColor("black");
//     doc.text(`Name: ${sale.customer?.name || "N/A"}`, 50, 220);
//     doc.text(`Phone: ${sale.customer?.phone || "N/A"}`, 50, 240);

//     // ----- Table Header -----
//     const drawTableRow = (y, c1, c2, c3, c4, isHeader = false) => {
//       doc
//         .font(isHeader ? "Helvetica-Bold" : "Helvetica")
//         .fontSize(12)
//         .fillColor(isHeader ? "white" : "black");

//       // Background for header
//       if (isHeader) {
//         doc.rect(50, y, 500, rowHeight).fill("#1f2937").stroke();
//         doc.fillColor("white");
//       }

//       doc.text(c1, 55, y + 10, { width: 200, align: "left" });
//       doc.text(c2, 260, y + 10, { width: 40, align: "center" });
//       doc.text(c3, 320, y + 10, { width: 80, align: "right" });
//       doc.text(c4, 420, y + 10, { width: 120, align: "right" });

//       // Row border
//       doc.rect(50, y, 500, rowHeight).stroke();
//     };

//     drawTableRow(tableTop, "Product", "Qty", "Price", "Total", true);

//     // ----- Table Rows -----
//     let totalAmount = 0;
//     let y = tableTop + rowHeight;

//     sale.items.forEach((item) => {
//       const product = item.product || {};
//       const title = product.title || "Unknown Product";
//       const price = item.price || product.salePrice || 0;
//       const qty = item.quantity || 0;
//       const total = qty * price;
//       totalAmount += total;

//       drawTableRow(
//         y,
//         title,
//         qty.toString(),
//         price.toFixed(2),
//         total.toFixed(2)
//       );
//       y += rowHeight;
//     });

//     // ----- Total -----
//     doc
//       .font("Helvetica-Bold")
//       .fontSize(14)
//       .fillColor("#111827")
//       .text(`Grand Total: ${totalAmount.toFixed(2)}`, 420, y + 20, {
//         width: 120,
//         align: "right",
//       });

//     // ----- Footer -----
//     doc
//       .fontSize(10)
//       .fillColor("#6b7280")
//       .text("Thank you for your purchase!", 50, 750, { align: "center" });

//     doc.end();
//   } catch (err) {
//     console.error("Error generating invoice:", err);
//     if (!res.headersSent) {
//       res.status(500).json({ message: "Failed to generate invoice" });
//     }
//   }
// };

// export default generateInvoice;
