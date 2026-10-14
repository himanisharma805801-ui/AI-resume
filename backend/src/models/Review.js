const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 80, default: '' },
  resumeExcerpt: { type: String, required: true, maxlength: 20000 },
  jobExcerpt: { type: String, required: true, maxlength: 12000 },
  score: { type: Number, required: true, min: 0, max: 100 },
  summary: { type: String, required: true },
  strengths: [{ type: String }],
  improvements: [{ type: String }],
  actionPlan: [{ type: String }],
  aiGenerated: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
