const mongoose = require("mongoose");

// A single document per counter name, incremented atomically via findOneAndUpdate's $inc.
// This is the standard MongoDB auto-increment pattern - unlike counting existing documents,
// $inc on a dedicated counter document is a single atomic operation, so two requests arriving
// at the exact same millisecond are still guaranteed to get different sequence numbers.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "orderNumber", "customOrderNumber"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

async function getNextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = { getNextSequence };
