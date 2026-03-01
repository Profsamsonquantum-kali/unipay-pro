const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Bank details
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    routingNumber: String,
    swiftCode: String,
    iban: String,
    
    // Plaid integration
    plaidAccessToken: String,
    plaidAccountId: String,
    plaidItemId: String,
    
    // Status
    isVerified: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    
    // Metadata
    currency: { type: String, default: 'USD' },
    country: String,
    accountType: { type: String, enum: ['checking', 'savings'] },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BankAccount', bankAccountSchema);