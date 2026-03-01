const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    investmentId: { type: String, required: true, unique: true },
    
    // Investment details
    productId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    returns: { type: Number, default: 0 },
    
    // Performance
    apy: Number,
    dailyReturn: Number,
    totalReturn: Number,
    
    // Dates
    startedAt: { type: Date, default: Date.now },
    maturityDate: Date,
    
    // Status
    status: { 
        type: String, 
        enum: ['active', 'withdrawn', 'matured'],
        default: 'active'
    },
    
    // History
    returnsHistory: [{
        date: Date,
        amount: Number,
        type: { type: String, enum: ['interest', 'dividend', 'capital'] }
    }]
});

module.exports = mongoose.model('Investment', investmentSchema);