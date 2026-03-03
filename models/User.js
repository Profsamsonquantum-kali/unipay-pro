const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Personal Information
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    country: { type: String, required: true },
    dateOfBirth: Date,
    
    // Security
    password: { type: String, required: true },
    twoFactorSecret: String,
    twoFactorEnabled: { type: Boolean, default: false },
    
    // Verification
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isIdVerified: { type: Boolean, default: false },
    verificationLevel: { type: Number, default: 0 }, // 0-3
    
    // Balances - REAL MONEY
    balances: {
        USD: { type: Number, default: 0 },
        EUR: { type: Number, default: 0 },
        GBP: { type: Number, default: 0 },
        KES: { type: Number, default: 0 },
        NGN: { type: Number, default: 0 },
        ZAR: { type: Number, default: 0 },
        GHS: { type: Number, default: 0 },
        TZS: { type: Number, default: 0 },
        UGX: { type: Number, default: 0 }
    },
    
    // Crypto Balances - REAL CRYPTO
    crypto: {
        BTC: { type: Number, default: 0 },
        ETH: { type: Number, default: 0 },
        USDT: { type: Number, default: 0 },
        USDC: { type: Number, default: 0 },
        BNB: { type: Number, default: 0 },
        SOL: { type: Number, default: 0 },
        XRP: { type: Number, default: 0 },
        ADA: { type: Number, default: 0 }
    },
    
    // Bank Accounts - REAL BANKS
    bankAccounts: [{
        bankName: String,
        accountNumber: String,
        routingNumber: String,
        swiftCode: String,
        iban: String,
        currency: String,
        isVerified: { type: Boolean, default: false },
        plaidAccessToken: String,
        plaidAccountId: String
    }],
    
    // Cards - REAL CARDS
    cards: [{
        cardId: String,
        last4: String,
        brand: String,
        type: { type: String, enum: ['virtual', 'physical'] },
        status: { type: String, default: 'active' },
        limit: Number,
        currency: String,
        expiryMonth: String,
        expiryYear: String
    }],
    
    // Loans - REAL LOANS
    loans: [{
        loanId: String,
        amount: Number,
        currency: String,
        interestRate: Number,
        term: Number,
        status: { type: String, default: 'active' },
        nextPayment: Date,
        remainingBalance: Number
    }],
    
    // Investments - REAL INVESTMENTS
    investments: [{
        type: { type: String, enum: ['stock', 'bond', 'crypto', 'savings'] },
        amount: Number,
        currency: String,
        returns: Number,
        maturityDate: Date
    }],
    
    // Limits
    limits: {
        dailyTransfer: { type: Number, default: 10000 },
        monthlyTransfer: { type: Number, default: 50000 },
        withdrawalLimit: { type: Number, default: 5000 }
    },
    
    // Referral
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralEarnings: { type: Number, default: 0 },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date,
    updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.methods.correctPassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
