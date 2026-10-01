const Order = require("../models/Order");
const CustomOrder = require("../models/CustomOrder");
const { getNextSequence } = require("../models/Counter");

// Uses an atomic MongoDB counter (see models/Counter.js) instead of counting existing
// documents - counting-then-incrementing is a classic race condition: two requests arriving
// at nearly the same moment can both read the same count before either saves, producing the
// same "next" number and a duplicate-key error. $inc on a dedicated counter document is a
// single atomic operation, so this is safe under concurrency.
async function generateOrderNumber() {
  const seq = await getNextSequence("orderNumber");
  return `SR${10000 + seq}`;
}

async function generateCustomOrderNumber() {
  const seq = await getNextSequence("customOrderNumber");
  return `SRC${5000 + seq}`;
}

module.exports = { generateOrderNumber, generateCustomOrderNumber };
