const mongoose = require("mongoose");
const Order = require("../models/Order");
const CustomOrder = require("../models/CustomOrder");

// Runs once at server startup. If the atomic counters (models/Counter.js) don't exist yet -
// e.g. the first boot after this fix was deployed - seed them from the current highest
// existing order/custom-order number instead of starting back at 0, so newly generated
// numbers never collide with orders that already exist in the database.
async function ensureCounters() {
  const db = mongoose.connection;
  const counters = db.collection("counters");

  const seedIfMissing = async (id, model, prefix) => {
    const existing = await counters.findOne({ _id: id });
    if (existing) return; // already seeded on a previous boot - never overwrite

    const highest = await model
      .find({})
      .sort({ createdAt: -1 })
      .limit(1)
      .then((docs) => docs[0]);

    let seed = 0;
    if (highest) {
      const numeric = parseInt(String(highest.orderNumber || highest.customOrderNumber).replace(/\D/g, ""), 10);
      const base = id === "orderNumber" ? 10000 : 5000;
      if (!Number.isNaN(numeric) && numeric > base) seed = numeric - base;
    }

    await counters.updateOne({ _id: id }, { $setOnInsert: { seq: seed } }, { upsert: true });
    console.log(`Order number counter "${id}" initialized at ${seed}`);
  };

  await seedIfMissing("orderNumber", Order, "SR");
  await seedIfMissing("customOrderNumber", CustomOrder, "SRC");
}

module.exports = ensureCounters;
