const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    loanId: { type: String, required: true, unique: true },
    
    // Loan details
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    interestRate: { type: Number, required: true },
    term: { type: Number, required: true }, // in years
    
    // Repayment
    monthlyPayment: Number,
    totalRepayment: Number,
    remainingBalance: Number,
    purpose: String,
    
    // Payments history
    payments: [{
        amount: Number,
        date: Date,
        transactionId: String
    }],
    
    // Dates
    appliedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    disbursedAt: Date,
    nextPayment: Date,
    
    // Status
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'active', 'paid', 'defaulted'],
        default: 'pending'
    },
    
    // Credit assessment
    creditScore: Number,
    riskLevel: { type: String, enum: ['low', 'medium', 'high'] }
});

module.exports = mongoose.model('Loan', loanSchema);