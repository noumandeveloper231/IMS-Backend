import Counter from "../models/counterModel.js";

async function getNextInvoice(prefix = "INV") {
  const year = new Date().getFullYear(); // e.g. 2025
  const shortYear = year.toString().slice(-2); // e.g. "25"

  const counterId = `invoice-${year}`; // unique counter per year

  const counter = await Counter.findOneAndUpdate(
    { id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  // 7-digit sequence, starting from 0000001
  const sequence = counter.seq.toString().padStart(5, "0");

  const invoiceNumber = `${prefix}-${shortYear}${sequence}`;
  return invoiceNumber;
}

export default getNextInvoice;
