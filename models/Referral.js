const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referredId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: String,
  status: { type: String, enum: ['pending', 'verified', 'paid'], default: 'pending' },
  earnedAmount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  verifiedAt: Date
});

module.exports = mongoose.model('Referral', ReferralSchema);
