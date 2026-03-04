const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const jwt = require('jsonwebtoken');

// ==================== AUTH MIDDLEWARE ====================
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'No token provided' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({ 
                status: 'error', 
                message: 'User not found' 
            });
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ 
            status: 'error', 
            message: 'Invalid token' 
        });
    }
};

// ==================== GET CURRENT USER ====================
router.get('/me', authenticate, async (req, res) => {
    try {
        res.json({ 
            status: 'success', 
            data: { user: req.user } 
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== GET USER BALANCE ====================
router.get('/balance', authenticate, async (req, res) => {
    try {
        const user = req.user;
        
        // Calculate total USD value (simplified rates)
        const rates = {
            USD: 1, EUR: 1.08, GBP: 1.26, KES: 0.0067,
            BTC: 51234.50, ETH: 3123.45, BNB: 412.75, SOL: 123.45
        };
        
        let totalUSD = 0;
        
        // Calculate fiat total
        Object.entries(user.balances || {}).forEach(([currency, amount]) => {
            totalUSD += amount * (rates[currency] || 1);
        });
        
        // Calculate crypto total
        Object.entries(user.crypto || {}).forEach(([currency, amount]) => {
            totalUSD += amount * (rates[currency] || 0);
        });

        res.json({
            status: 'success',
            data: {
                balances: user.balances || {},
                crypto: user.crypto || {},
                totalUSD
            }
        });

    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== GET TRANSACTIONS ====================
router.get('/transactions', authenticate, async (req, res) => {
    try {
        const { limit = 20, offset = 0, type = 'all' } = req.query;
        
        // Mock transactions for now (replace with real DB queries)
        const transactions = [
            {
                _id: '1',
                type: 'send',
                amount: 100,
                currency: 'USD',
                toAddress: 'friend@example.com',
                status: 'completed',
                date: new Date(),
                description: 'Payment for dinner'
            },
            {
                _id: '2',
                type: 'receive',
                amount: 500,
                currency: 'KES',
                fromAddress: 'boss@company.com',
                status: 'completed',
                date: new Date(Date.now() - 86400000),
                description: 'Salary'
            },
            {
                _id: '3',
                type: 'exchange',
                amount: 0.001,
                currency: 'BTC',
                status: 'completed',
                date: new Date(Date.now() - 172800000),
                description: 'Bought Bitcoin'
            }
        ];

        res.json({
            status: 'success',
            data: { 
                transactions,
                total: transactions.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== UPDATE PROFILE ====================
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { firstName, lastName, phone } = req.body;
        
        if (firstName) req.user.firstName = firstName;
        if (lastName) req.user.lastName = lastName;
        if (phone) req.user.phone = phone;
        
        await req.user.save();

        res.json({
            status: 'success',
            data: { user: req.user }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

module.exports = router;