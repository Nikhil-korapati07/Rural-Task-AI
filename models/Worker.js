const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  skills: [{ type: String }],
  location: { type: String, default: 'Unknown' },
  skillConfidence: { type: Map, of: Number, default: {} },
  skillUsageCount: { type: Map, of: Number, default: {} },
  reliabilityScore: { type: Number, default: 50 },
  status: { type: String, enum: ['available', 'busy'], default: 'available' },
  failureReasons: { type: Map, of: Number, default: {} },
  feedbackHistory: [
    {
      rating: Number,
      comment: String,
      jobTitle: String,
      date: String
    }
  ],
  taskHistory: {
    total: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    failure: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Worker', workerSchema);
