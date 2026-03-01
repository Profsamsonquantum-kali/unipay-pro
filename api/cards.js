const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');

// ==================== CREATE REAL VIRTUAL CARD ====================
router.post('/create', auth, async (req, res) => {
    try {
        const { currency, limit } = req.body;
        
        const user = await User.findById(req.userId);
        
        // Create REAL card via Stripe Issuing
        const card = await stripe.issuing.cards.create({
            currency: currency.toLowerCase(),
            type: 'virtual',
            status: 'active',
            cardholder: await getOrCreateCardholder(user),
            spending_controls: {
                spending_limits: [{
                    amount: limit * 100,
                    interval: 'monthly',
                    currency: currency.toLowerCase()
                }]
            }
        });
        
        // Store card in database
        user.cards.push({
            cardId: card.id,
            last4: card.last4,
            brand: card.brand,
            type: 'virtual',
            limit,
            currency,
            expiryMonth: card.exp_month,
            expiryYear: card.exp_year
        });
        
        await user.save();
        
        res.json({
            success: true,
            card: {
                id: card.id,
                last4: card.last4,
                brand: card.brand,
                expiryMonth: card.exp_month,
                expiryYear: card.exp_year,
                limit
            }
        });
        
    } catch (error) {
        console.error('Card creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to get or create Stripe cardholder
async function getOrCreateCardholder(user) {
    // Check if cardholder exists
    if (user.stripeCardholderId) {
        return user.stripeCardholderId;
    }
    
    // Create new cardholder
    const cardholder = await stripe.issuing.cardholders.create({
        type: 'individual',
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone_number: user.phone,
        billing: {
            address: {
                line1: '123 Main St', // Get from user profile
                city: 'Nairobi',
                country: 'KE'
            }
        }
    });
    
    user.stripeCardholderId = cardholder.id;
    await user.save();
    
    return cardholder.id;
}

// ==================== GET REAL CARD TRANSACTIONS ====================
router.get('/transactions/:cardId', auth, async (req, res) => {
    try {
        const { cardId } = req.params;
        
        // Get REAL transactions from Stripe
        const transactions = await stripe.issuing.transactions.list({
            card: cardId,
            limit: 100
        });
        
        res.json({
            success: true,
            transactions: transactions.data.map(t => ({
                id: t.id,
                amount: t.amount / 100,
                currency: t.currency,
                merchant: t.merchant_data.name,
                category: t.merchant_data.category,
                status: t.status,
                date: new Date(t.created * 1000)
            }))
        });
        
    } catch (error) {
        console.error('Card transactions error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== FREEZE/UNFREEZE CARD ====================
router.post('/:cardId/:action', auth, async (req, res) => {
    try {
        const { cardId, action } = req.params;
        
        const user = await User.findById(req.userId);
        const card = user.cards.find(c => c.cardId === cardId);
        
        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }
        
        // Update card status in Stripe
        const updatedCard = await stripe.issuing.cards.update(cardId, {
            status: action === 'freeze' ? 'inactive' : 'active'
        });
        
        // Update local database
        card.status = action === 'freeze' ? 'frozen' : 'active';
        await user.save();
        
        res.json({
            success: true,
            status: card.status
        });
        
    } catch (error) {
        console.error('Card action error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;