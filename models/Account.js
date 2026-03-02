const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  currency: { type: String, required: true },
  balance: { type: Number, default: 0 },
  accountNumber: { type: String, unique: true },
  accountType: { type: String, enum: ['savings', 'checking', 'business'], default: 'savings' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Account', AccountSchema);
