// src/utils/generateInvoicePuppeteer.js
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";

// Company info config (can be fetched from DB)
const companyInfo = {
  name: "Al Ramil Al Abyad",
  address: "Shop# 1, Industrial Area# 6 UAE Sharjah",
  phone: "+971 54 784 6521",
  email: "info@ramil.ae",
  logoPath: path.resolve("src/assets/logo.png"),
};

const generateInvoicePDF = async (res, sale) => {
  // Status color
  const status = sale.status ? sale.status.toLowerCase() : "unpaid"; // default
  const statusColor = status === "paid" ? "#16a34a" : "#dc2626"; // green/red
  try {
    const logoDataUrl = fs.existsSync(companyInfo.logoPath)
      ? `data:image/png;base64,${fs.readFileSync(
          companyInfo.logoPath,
          "base64"
        )}`
      : "";

    // QR code for invoice verification
    const invoiceUrl = `https://alramil.ae/invoice/${sale._id}`;
    const qrDataUrl = await QRCode.toDataURL(invoiceUrl);

    // Calculate totals with tax and discount
    const subtotal = sale.items.reduce((acc, item) => {
      const price = item.price || item.product?.salePrice || 0;
      const qty = item.quantity || 0;
      return acc + price * qty;
    }, 0);

    const tax = sale.tax || 0;
    const discount = sale.discount || 0;
    const total = subtotal + tax - discount;

    // Generate HTML with inline Tailwind
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #111827; }
          .text-blue-600 { color: #3b82f6; }
          .text-gray-600 { color: #4b5563; }
          .text-gray-100 { background-color: #f3f4f6; }
          .text-green-600 { color: #16a34a; }
          .text-red-600 { color: #dc2626; }
          .font-bold { font-weight: bold; }
          .p-2 { padding: 0.5rem; }
          .p-8 { padding: 2rem; }
          .mb-6 { margin-bottom: 1.5rem; }
          .mt-8 { margin-top: 2rem; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
          th, td { border: 1px solid #ddd; padding: 8px; }
          th { background-color: #111827; color: white; text-align: left; }
          tr:nth-child(even) { background-color: #f3f4f6; }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="text-center mb-6">
          ${
            logoDataUrl
              ? `<img src="${logoDataUrl}" alt="Logo" style="height:60px;margin-bottom:10px;" />`
              : ""
          }
          <h1 class="text-3xl font-bold text-blue-600">${companyInfo.name}</h1>
          <p class="text-gray-600">${companyInfo.address}</p>
          <p class="text-gray-600">Phone: ${companyInfo.phone} | Email: ${
      companyInfo.email
    }</p>
        </div>

        <!-- Invoice & Customer -->
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
          <div>
            <h2 class="text-xl font-bold text-blue-600">INVOICE</h2>
            <p>Invoice No: ${sale.invoiceNo}</p>
            <p>Date: ${new Date(sale.createdAt).toLocaleDateString()}</p>
            <p>Status: <span style="color:${statusColor};font-weight:bold;">${sale.status.toUpperCase()}</span></p>
          </div>
          <div style="text-align:right;">
            <h3 class="font-bold">Bill To:</h3>
            <p>${sale.customer?.name || "N/A"}</p>
            <p>${sale.customer?.phone || "N/A"}</p>
          </div>
        </div>

        <!-- Table -->
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items
              .map((item, index) => {
                const product = item.product || {};
                const price = item.price || product.salePrice || 0;
                const qty = item.quantity || 0;
                const totalRow = price * qty;
                return `<tr style="${
                  index % 2 === 0 ? "background-color:#f3f4f6;" : ""
                }">
                <td class="p-2">${product.title || "Unknown Product"}</td>
                <td class="p-2 text-center">${qty}</td>
                <td class="p-2 text-right">$${price.toFixed(2)}</td>
                <td class="p-2 text-right">$${totalRow.toFixed(2)}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>

        <!-- Subtotal, Tax, Discount, Total -->
        <div style="text-align:right;margin-bottom:20px;">
          <p>Subtotal: $${subtotal.toFixed(2)}</p>
          <p>Tax: $${tax.toFixed(2)}</p>
          <p>Discount: $${discount.toFixed(2)}</p>
          <p class="font-bold text-xl text-blue-600">Grand Total: $${total.toFixed(
            2
          )}</p>
        </div>

        <!-- QR Code -->
        <div class="text-center mt-8">
          <p>Scan QR code for invoice verification</p>
          <img src="${qrDataUrl}" alt="QR Code" style="height:100px;margin-top:10px;" />
        </div>

        <!-- Footer -->
        <div class="text-center mt-8 text-gray-600">
          <p>Thank you for your purchase!</p>
          <p>Authorized Signature: ____________________</p>
        </div>
      </body>
      </html>
    `;

    // Decide executable path: local dev vs serverless (Vercel/Lambda)
    const isDev = process.env.NODE_ENV !== "production";

    // On Vercel/Lambda, chromium.executablePath() returns the bundled binary.
    // On local Windows dev, point to your installed Chrome if chromium has none.
    let executablePath = await chromium.executablePath();

    if (isDev && !executablePath) {
      // Adjust this path if your Chrome is installed elsewhere
      executablePath =
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=invoice-${sale.invoiceNo}.pdf`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Error generating PDF:", err);
    if (!res.headersSent)
      res.status(500).json({ message: "Failed to generate invoice" });
  }
};

export default generateInvoicePDF;

// // src/utils/generateInvoicePuppeteer.js
// import puppeteer from "puppeteer";
// import QRCode from "qrcode";
// import path from "path";
// import fs from "fs";

// const generateInvoicePDF = async (res, sale) => {
//   try {
//     // Generate QR code for invoice URL (or payment)
//     const invoiceUrl = `https://alramil.ae/invoice/${sale._id}`;
//     const qrDataUrl = await QRCode.toDataURL(invoiceUrl);

//     const grandTotal = sale.items.reduce((acc, item) => {
//       const price = item.price || item.product?.salePrice || 0;
//       const qty = item.quantity || 0;
//       return acc + price * qty;
//     }, 0);

//     // Path to logo
//     const logoPath = path.resolve("src/assets/logo.png"); // adjust path
//     const logoDataUrl = fs.existsSync(logoPath)
//       ? `data:image/png;base64,${fs.readFileSync(logoPath, "base64")}`
//       : "";

//     // HTML template with inline TailwindCSS
//     const html = `
//       <!DOCTYPE html>
//       <html lang="en">
//       <head>
//         <meta charset="UTF-8" />
//         <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//         <style>
//           /* Minimal TailwindCSS inline for Puppeteer */
//           body { font-family: Arial, sans-serif; margin: 40px; color: #111827; }
//           .text-blue-600 { color: #3b82f6; }
//           .font-bold { font-weight: bold; }
//           .text-xl { font-size: 1.25rem; }
//           .text-3xl { font-size: 1.875rem; }
//           .text-gray-600 { color: #4b5563; }
//           .text-gray-100 { background-color: #f3f4f6; }
//           .p-2 { padding: 0.5rem; }
//           .p-8 { padding: 2rem; }
//           .mb-6 { margin-bottom: 1.5rem; }
//           .mt-8 { margin-top: 2rem; }
//           .text-right { text-align: right; }
//           .text-center { text-align: center; }
//           table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
//           th, td { border: 1px solid #ddd; padding: 8px; }
//           th { background-color: #111827; color: white; text-align: left; }
//           tr:nth-child(even) { background-color: #f3f4f6; }
//         </style>
//       </head>
//       <body>
//         <!-- Header -->
//         <div class="text-center mb-6">
//           ${
//             logoDataUrl
//               ? `<img src="${logoDataUrl}" alt="Logo" style="height:60px;margin-bottom:10px;" />`
//               : ""
//           }
//           <h1 class="text-3xl font-bold text-blue-600">Al Ramil Al Abyad</h1>
//           <p class="text-gray-600">Shop# 1, Industrial Area# 6 UAE Sharjah</p>
//           <p class="text-gray-600">Phone: +971 54 784 6521 | Email: info@ramil.ae</p>
//         </div>

//         <!-- Invoice & Customer -->
//         <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
//           <div>
//             <h2 class="text-xl font-bold text-blue-600">INVOICE</h2>
//             <p>Invoice No: ${sale.invoiceNo}</p>
//             <p>Date: ${new Date(sale.createdAt).toLocaleDateString()}</p>
//           </div>
//           <div style="text-align:right;">
//             <h3 class="font-bold">Bill To:</h3>
//             <p>${sale.customer?.name || "N/A"}</p>
//             <p>${sale.customer?.phone || "N/A"}</p>
//           </div>
//         </div>

//         <!-- Table -->
//         <table>
//           <thead>
//             <tr>
//               <th>Product</th>
//               <th style="text-align:center;">Qty</th>
//               <th style="text-align:right;">Price</th>
//               <th style="text-align:right;">Total</th>
//             </tr>
//           </thead>
//           <tbody>
//             ${sale.items
//               .map((item, index) => {
//                 const product = item.product || {};
//                 const price = item.price || product.salePrice || 0;
//                 const qty = item.quantity || 0;
//                 const total = price * qty;
//                 return `
//                   <tr style="${
//                     index % 2 === 0 ? "background-color:#f3f4f6;" : ""
//                   }">
//                     <td class="p-2">${product.title || "Unknown Product"}</td>
//                     <td class="p-2 text-center">${qty}</td>
//                     <td class="p-2 text-right">$${price.toFixed(2)}</td>
//                     <td class="p-2 text-right">$${total.toFixed(2)}</td>
//                   </tr>
//                 `;
//               })
//               .join("")}
//           </tbody>
//         </table>

//         <!-- Grand Total & QR -->
//         <div class="text-right text-xl font-bold text-blue-600">
//           Grand Total: $${grandTotal.toFixed(2)}
//         </div>

//         <div class="text-center mt-8">
//           <p>Scan QR code for invoice verification</p>
//           <img src="${qrDataUrl}" alt="QR Code" style="height:100px;margin-top:10px;" />
//         </div>

//         <!-- Footer -->
//         <div class="text-center mt-8 text-gray-600">
//           <p>Thank you for your purchase!</p>
//           <p>Authorized Signature: ____________________</p>
//         </div>
//       </body>
//       </html>
//     `;

//     // Puppeteer
//     const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
//     const page = await browser.newPage();

//     await page.setContent(html, {
//       waitUntil: "domcontentloaded",
//       timeout: 60000, // 60s
//     });

//     const pdfBuffer = await page.pdf({
//       format: "A4",
//       printBackground: true,
//       margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
//     });

//     await browser.close();

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `inline; filename=invoice-${sale.invoiceNo}.pdf`
//     );
//     res.send(pdfBuffer);
//   } catch (err) {
//     console.error("Error generating PDF:", err);
//     if (!res.headersSent)
//       res.status(500).json({ message: "Failed to generate invoice" });
//   }
// };

// export default generateInvoicePDF;
