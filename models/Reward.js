const mongoose = require('mongoose');

const RewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  points: { type: Number, default: 0 },
  cashback: { type: Number, default: 0 },
  tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
  history: [{
    action: String,
    points: Number,
    date: Date
  }]
});

module.exports = mongoose.model('Reward', RewardSchema);
