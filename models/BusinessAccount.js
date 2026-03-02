const mongoose = require('mongoose');

const BusinessAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  businessName: String,
  businessType: String,
  registrationNumber: String,
  taxId: String,
  address: String,
  verified: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' }
});

module.exports = mongoose.model('BusinessAccount', BusinessAccountSchema);
