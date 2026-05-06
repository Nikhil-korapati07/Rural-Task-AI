const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  skill: { type: String, required: true },
  questions: { type: Array, required: true },
  source: { type: String, enum: ['ai', 'static'], default: 'ai' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Question', questionSchema);
