const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['worker', 'employer'], required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId }, // Links to Worker profile if role is worker
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
