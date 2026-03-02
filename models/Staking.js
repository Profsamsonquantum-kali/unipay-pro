const mongoose = require('mongoose');

const StakingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currency: { type: String, enum: ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT'], required: true },
  amount: Number,
  apy: Number,
  lockPeriod: Number,
  startDate: Date,
  endDate: Date,
  rewards: Number,
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' }
});

module.exports = mongoose.model('Staking', StakingSchema);
