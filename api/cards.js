const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Card = require('../models/Card');
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

// ==================== GET CARDS ====================
router.get('/', authenticate, async (req, res) => {
    try {
        // Mock cards for now
        const cards = req.user.cards || [
            {
                _id: '1',
                cardNumber: '**** **** **** 4242',
                cardHolderName: `${req.user.firstName} ${req.user.lastName}`.toUpperCase(),
                expiryMonth: '12',
                expiryYear: '25',
                type: 'virtual',
                brand: 'visa',
                limit: 5000,
                spent: 1234
            }
        ];

        res.json({
            status: 'success',
            data: { cards }
        });

    } catch (error) {
        console.error('Get cards error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== CREATE CARD ====================
router.post('/create', authenticate, async (req, res) => {
    try {
        const { type, accountId } = req.body;

        // Generate card details
        const cardNumber = '4' + Math.random().toString().slice(2, 15).padEnd(15, '0');
        const last4 = cardNumber.slice(-4);
        const expiryMonth = ('0' + (new Date().getMonth() + 1)).slice(-2);
        const expiryYear = (new Date().getFullYear() + 3).toString().slice(-2);
        
        const card = {
            _id: uuidv4(),
            cardId: 'card_' + uuidv4(),
            last4,
            brand: 'visa',
            type: type || 'virtual',
            limit: type === 'virtual' ? 5000 : 10000,
            currency: 'USD',
            spent: 0,
            expiryMonth,
            expiryYear,
            status: 'active',
            cardHolderName: `${req.user.firstName} ${req.user.lastName}`.toUpperCase()
        };

        // Save to user's cards
        if (!req.user.cards) req.user.cards = [];
        req.user.cards.push(card);
        await req.user.save();

        res.json({
            status: 'success',
            data: { 
                card: {
                    ...card,
                    cardNumber: `**** **** **** ${last4}`
                }
            }
        });

    } catch (error) {
        console.error('Create card error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ==================== FREEZE CARD ====================
router.post('/:cardId/freeze', authenticate, async (req, res) => {
    try {
        const { cardId } = req.params;
        
        const card = req.user.cards?.find(c => c._id === cardId || c.cardId === cardId);
        
        if (!card) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Card not found' 
            });
        }

        card.status = card.status === 'active' ? 'frozen' : 'active';
        await req.user.save();

        res.json({
            status: 'success',
            message: `Card ${card.status === 'frozen' ? 'frozen' : 'unfrozen'} successfully`,
            data: { card }
        });

    } catch (error) {
        console.error('Freeze card error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

module.exports = router;