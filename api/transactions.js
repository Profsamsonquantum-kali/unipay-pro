const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

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
        const user = await User.findById(decoded.id);
        
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

// ==================== SEND MONEY ====================
router.post('/send', authenticate, async (req, res) => {
    try {
        const { toAddress, amount, currency, description } = req.body;

        // Validate
        if (!toAddress || !amount || !currency) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing required fields' 
            });
        }

        if (amount <= 0) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Invalid amount' 
            });
        }

        // Check balance
        const userBalance = req.user.balances?.[currency] || 0;
        if (userBalance < amount) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Insufficient balance' 
            });
        }

        // Calculate fee
        const fee = amount * 0.01; // 1% fee
        const total = amount + fee;

        if (userBalance < total) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Insufficient balance including fees' 
            });
        }

        // Update balance
        req.user.balances[currency] -= total;
        await req.user.save();

        // Create transaction
        const transaction = {
            _id: uuidv4(),
            userId: req.userId,
            type: 'send',
            amount,
            currency,
            toAddress,
            description,
            fee,
            status: 'completed',
            date: new Date(),
            reference: 'TXN' + Date.now()
        };

        res.json({
            status: 'success',
            data: { 
                transaction,
                newBalance: req.user.balances[currency]
            }
        });

    } catch (error) {
        console.error('Send money error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== MOBILE MONEY ====================
router.post('/mobile-money', authenticate, async (req, res) => {
    try {
        const { phone, amount, provider } = req.body;

        // Validate
        if (!phone || !amount) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Phone and amount required' 
            });
        }

        // Check USD balance (assuming USD for mobile money)
        const userBalance = req.user.balances?.USD || 0;
        if (userBalance < amount) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Insufficient balance' 
            });
        }

        // Update balance
        req.user.balances.USD -= amount;
        await req.user.save();

        // Create transaction
        const transaction = {
            _id: uuidv4(),
            userId: req.userId,
            type: 'send',
            amount,
            currency: 'USD',
            toAddress: phone,
            description: `Mobile money to ${phone} via ${provider || 'M-Pesa'}`,
            status: 'completed',
            date: new Date()
        };

        res.json({
            status: 'success',
            message: 'Mobile money sent successfully',
            data: { transaction }
        });

    } catch (error) {
        console.error('Mobile money error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

module.exports = router;