const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: [
            'deposit', 'withdrawal', 'transfer', 'payment',
            'send', 'receive', 'exchange', 'loan', 'investment'
        ],
        required: true 
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    fee: { type: Number, default: 0 },
    totalAmount: Number,
    
    // REAL Transaction Details
    fromAccount: String,
    toAccount: String,
    fromAddress: String,
    toAddress: String,
    
    // REAL Banking Details
    bankName: String,
    accountNumber: String,
    routingNumber: String,
    swiftCode: String,
    iban: String,
    
    // REAL Mobile Money
    mobileProvider: String,
    mobileNumber: String,
    
    // REAL Crypto
    cryptoNetwork: String,
    cryptoAddress: String,
    txHash: String,
    confirmations: Number,
    
    // REAL Card
    cardLast4: String,
    merchantName: String,
    merchantCategory: String,
    
    // Status
    status: { 
        type: String, 
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    
    // REAL Reference
    reference: { type: String, unique: true },
    description: String,
    
    // REAL Timestamps
    initiatedAt: { type: Date, default: Date.now },
    processedAt: Date,
    completedAt: Date,
    
    // REAL Location
    ipAddress: String,
    location: String
});

transactionSchema.pre('save', function(next) {
    if (!this.reference) {
        this.reference = 'TXN' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);