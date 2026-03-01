const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// ==================== GET USER BALANCES ====================
router.get('/balances', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('balances crypto');
        
        // Calculate total in USD (simplified)
        const rates = {
            USD: 1, KES: 0.0066, NGN: 0.00065, ZAR: 0.053,
            BTC: 51234.50, ETH: 3123.45
        };

        let totalUSD = 0;
        
        // Fiat totals
        Object.entries(user.balances || {}).forEach(([currency, amount]) => {
            totalUSD += amount * (rates[currency] || 1);
        });

        // Crypto totals
        Object.entries(user.crypto || {}).forEach(([currency, amount]) => {
            totalUSD += amount * (rates[currency] || 0);
        });

        res.json({
            success: true,
            data: {
                balances: user.balances || {},
                crypto: user.crypto || {},
                totalUSD
            }
        });
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== GET TRANSACTION HISTORY ====================
router.get('/transactions', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({
            success: true,
            data: { transactions }
        });
    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== SEND MONEY ====================
router.post('/send', auth, async (req, res) => {
    try {
        const { to, amount, currency, description } = req.body;

        const sender = await User.findById(req.userId);
        if (!sender) {
            return res.status(404).json({ error: 'Sender not found' });
        }

        // Determine which balance to use
        let balanceField = 'balances.' + currency;
        let senderBalance = sender.balances?.[currency] || 0;

        // Check if it's crypto
        const cryptoCurrencies = ['BTC', 'ETH', 'BNB', 'SOL', 'USDT'];
        if (cryptoCurrencies.includes(currency)) {
            balanceField = 'crypto.' + currency;
            senderBalance = sender.crypto?.[currency] || 0;
        }

        // Check balance
        if (senderBalance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Find recipient by email
        const recipient = await User.findOne({ email: to });
        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        // Deduct from sender
        if (cryptoCurrencies.includes(currency)) {
            sender.crypto[currency] = (sender.crypto[currency] || 0) - amount;
        } else {
            sender.balances[currency] = (sender.balances[currency] || 0) - amount;
        }
        await sender.save();

        // Add to recipient
        if (cryptoCurrencies.includes(currency)) {
            recipient.crypto[currency] = (recipient.crypto[currency] || 0) + amount;
        } else {
            recipient.balances[currency] = (recipient.balances[currency] || 0) + amount;
        }
        await recipient.save();

        // Create transaction record
        const transaction = new Transaction({
            userId: sender._id,
            type: 'send',
            amount,
            currency,
            toAddress: recipient.email,
            description,
            status: 'completed',
            reference: 'SEND-' + Date.now()
        });
        await transaction.save();

        // Create receive record for recipient
        const receiveTx = new Transaction({
            userId: recipient._id,
            type: 'receive',
            amount,
            currency,
            fromAddress: sender.email,
            description,
            status: 'completed',
            reference: 'RECV-' + Date.now()
        });
        await receiveTx.save();

        res.json({
            success: true,
            transaction
        });
    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== DEPOSIT ====================
router.post('/deposit', auth, async (req, res) => {
    try {
        const { amount, currency } = req.body;

        const user = await User.findById(req.userId);
        
        // Add to balance
        user.balances[currency] = (user.balances[currency] || 0) + amount;
        await user.save();

        // Create transaction
        const transaction = new Transaction({
            userId: user._id,
            type: 'deposit',
            amount,
            currency,
            status: 'completed',
            reference: 'DEP-' + Date.now()
        });
        await transaction.save();

        res.json({
            success: true,
            transaction,
            newBalance: user.balances[currency]
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== WITHDRAW ====================
router.post('/withdraw', auth, async (req, res) => {
    try {
        const { amount, currency } = req.body;

        const user = await User.findById(req.userId);
        
        // Check balance
        if ((user.balances[currency] || 0) < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct from balance
        user.balances[currency] -= amount;
        await user.save();

        // Create transaction
        const transaction = new Transaction({
            userId: user._id,
            type: 'withdraw',
            amount,
            currency,
            status: 'completed',
            reference: 'WDR-' + Date.now()
        });
        await transaction.save();

        res.json({
            success: true,
            transaction,
            newBalance: user.balances[currency]
        });
    } catch (error) {
        console.error('Withdraw error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
