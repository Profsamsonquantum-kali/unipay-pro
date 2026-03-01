const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Card details
    cardId: { type: String, required: true, unique: true },
    last4: { type: String, required: true },
    brand: { type: String, enum: ['visa', 'mastercard', 'amex'] },
    type: { type: String, enum: ['virtual', 'physical'] },
    
    // Limits
    limit: Number,
    currency: { type: String, default: 'USD' },
    spent: { type: Number, default: 0 },
    
    // Dates
    expiryMonth: String,
    expiryYear: String,
    
    // Status
    status: { 
        type: String, 
        enum: ['active', 'frozen', 'blocked', 'expired'],
        default: 'active'
    },
    
    // Stripe integration
    stripeCardId: String,
    stripeCardholderId: String,
    
    // Metadata
    isDefault: { type: Boolean, default: false },
    
    createdAt: { type: Date, default: Date.now },
    activatedAt: Date,
    lastUsed: Date
});

module.exports = mongoose.model('Card', cardSchema);