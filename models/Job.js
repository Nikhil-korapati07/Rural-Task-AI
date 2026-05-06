const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  requiredSkills: [{ type: String }],
  skillPriorities: [
    {
      skill: String,
      priority: Number
    }
  ],
  location: { type: String, default: 'Unknown' },
  status: { 
    type: String, 
    enum: ['Pending', 'Assigned', 'InProgress', 'Completed', 'Failed'], 
    default: 'Pending' 
  },
  assignedWorker: {
    id: mongoose.Schema.Types.ObjectId,
    name: String
  },
  confidenceScore: { type: Number },
  scoreBreakdown: {
    skillMatch: Number,
    skillConfidence: Number,
    reliability: Number,
    locationBonus: Number,
    skillUsageBonus: Number
  },
  assignmentReason: { type: String },
  reassignmentHistory: [
    {
      previousWorker: {
        id: mongoose.Schema.Types.ObjectId,
        name: String
      },
      previousScore: Number,
      previousReason: String,
      reassignedAt: Date
    }
  ],
  timeline: [{ type: String }],
  feedback: {
    rating: Number,
    comment: String
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
