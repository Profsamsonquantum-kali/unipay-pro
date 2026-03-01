const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Get investment products
router.get('/products', async (req, res) => {
    try {
        const products = [
            {
                id: 'savings-1',
                type: 'savings',
                name: 'High-Yield Savings',
                apy: 4.5,
                minAmount: 100,
                currency: 'USD',
                risk: 'low',
                term: 'flexible'
            },
            {
                id: 'bond-1',
                type: 'bond',
                name: 'Government Bond',
                apy: 6.8,
                minAmount: 1000,
                currency: 'USD',
                risk: 'low',
                term: '12 months'
            },
            {
                id: 'stock-1',
                type: 'stock',
                name: 'Tech Growth Fund',
                apy: 12.5,
                minAmount: 500,
                currency: 'USD',
                risk: 'medium',
                term: 'flexible'
            },
            {
                id: 'crypto-1',
                type: 'crypto',
                name: 'Crypto Index Fund',
                apy: 18.0,
                minAmount: 100,
                currency: 'USD',
                risk: 'high',
                term: 'flexible'
            }
        ];

        res.json({ success: true, products });
    } catch (error) {
        console.error('Investment products error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Invest
router.post('/invest', auth, async (req, res) => {
    try {
        const { productId, amount, currency } = req.body;

        const user = await User.findById(req.userId);

        // Check balance
        if (user.balances[currency] < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct from user
        user.balances[currency] -= amount;
        await user.save();

        // Create investment
        const investment = new Investment({
            userId: req.userId,
            investmentId: 'INV-' + uuidv4().substring(0, 8).toUpperCase(),
            productId,
            amount,
            currency,
            returns: 0,
            status: 'active'
        });
        await investment.save();

        // Add to user's investments
        await User.findByIdAndUpdate(req.userId, {
            $push: { investments: investment }
        });

        // Create transaction
        const transaction = new Transaction({
            userId: req.userId,
            type: 'investment',
            amount,
            currency,
            description: `Investment in ${productId}`,
            status: 'completed',
            reference: 'INV-' + uuidv4().substring(0, 8).toUpperCase(),
            completedAt: new Date()
        });
        await transaction.save();

        res.json({
            success: true,
            investment,
            transaction
        });

    } catch (error) {
        console.error('Investment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user investments
router.get('/', auth, async (req, res) => {
    try {
        const investments = await Investment.find({ userId: req.userId });
        res.json({ success: true, investments });
    } catch (error) {
        console.error('Get investments error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Calculate returns (simulated)
router.post('/:investmentId/returns', auth, async (req, res) => {
    try {
        const { investmentId } = req.params;

        const investment = await Investment.findOne({ investmentId, userId: req.userId });
        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        // Simulated returns calculation
        const dailyReturn = investment.amount * 0.0001; // 0.01% daily
        investment.returns += dailyReturn;
        await investment.save();

        res.json({
            success: true,
            returns: investment.returns
        });

    } catch (error) {
        console.error('Returns calculation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Withdraw investment
router.post('/:investmentId/withdraw', auth, async (req, res) => {
    try {
        const { investmentId } = req.params;

        const investment = await Investment.findOne({ investmentId, userId: req.userId });
        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        const totalValue = investment.amount + investment.returns;

        // Credit user
        await User.findByIdAndUpdate(req.userId, {
            $inc: { [`balances.${investment.currency}`]: totalValue }
        });

        investment.status = 'withdrawn';
        await investment.save();

        // Create transaction
        const transaction = new Transaction({
            userId: req.userId,
            type: 'investment-withdrawal',
            amount: totalValue,
            currency: investment.currency,
            description: `Withdrawal from investment ${investment.investmentId}`,
            status: 'completed',
            reference: 'WTH-' + uuidv4().substring(0, 8).toUpperCase(),
            completedAt: new Date()
        });
        await transaction.save();

        res.json({
            success: true,
            transaction,
            amount: totalValue
        });

    } catch (error) {
        console.error('Investment withdrawal error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;