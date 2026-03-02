const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const axios = require('axios');
const twilio = require('../sms/twilio');
const { v4: uuidv4 } = require('uuid');

// ==================== M-PESA (Kenya, Tanzania) - REAL ====================
router.post('/mpesa', auth, async (req, res) => {
    try {
        const { phone, amount, network } = req.body; // network: safaricom, vodacom
        
        const user = await User.findById(req.userId);
        
        // REAL M-Pesa API integration
        const mpesaResponse = await axios.post(process.env.MPESA_API_URL, {
            Initiator: process.env.MPESA_INITIATOR,
            SecurityCredential: process.env.MPESA_CREDENTIAL,
            CommandID: 'BusinessPayment',
            Amount: amount,
            PartyA: process.env.MPESA_SHORTCODE,
            PartyB: phone,
            Remarks: 'QuantumPay Transfer',
            QueueTimeOutURL: `${process.env.BASE_URL}/api/webhooks/mpesa/timeout`,
            ResultURL: `${process.env.BASE_URL}/api/webhooks/mpesa/result`
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.MPESA_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Deduct from user balance
        user.balances.KES -= amount;
        await user.save();
        
        // Create transaction
        const transaction = new Transaction({
            userId: user._id,
            type: 'send',
            amount,
            currency: 'KES',
            mobileProvider: 'M-Pesa',
            mobileNumber: phone,
            status: 'processing',
            reference: 'MPE-' + uuidv4().substring(0, 8).toUpperCase()
        });
        await transaction.save();
        
        // Send SMS
        await twilio.sendSMS(
            user.phone,
            `💸 Sent KES ${amount} to M-Pesa ${phone}`
        );
        
        res.json({
            success: true,
            message: 'M-Pesa transfer initiated',
            transaction
        });
        
    } catch (error) {
        console.error('M-Pesa error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== MTN Mobile Money (Ghana, Uganda, Rwanda) - REAL ====================
router.post('/mtn', auth, async (req, res) => {
    try {
        const { phone, amount, country } = req.body; // GH, UG, RW
        
        const user = await User.findById(req.userId);
        
        // REAL MTN API integration
        const mtnResponse = await axios.post(`${process.env.MTN_API_URL}/collection/v1_0/requesttopay`, {
            amount: amount,
            currency: country === 'GH' ? 'GHS' : country === 'UG' ? 'UGX' : 'RWF',
            externalId: Date.now().toString(),
            payer: {
                partyIdType: 'MSISDN',
                partyId: phone
            },
            payerMessage: 'QuantumPay Transfer',
            payeeNote: 'Payment from QuantumPay'
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.MTN_TOKEN}`,
                'X-Reference-Id': uuidv4(),
                'X-Target-Environment': 'production'
            }
        });
        
        const currency = country === 'GH' ? 'GHS' : country === 'UG' ? 'UGX' : 'RWF';
        
        // Deduct from user balance
        user.balances[currency] -= amount;
        await user.save();
        
        // Create transaction
        const transaction = new Transaction({
            userId: user._id,
            type: 'send',
            amount,
            currency,
            mobileProvider: 'MTN Mobile Money',
            mobileNumber: phone,
            status: 'processing',
            reference: 'MTN-' + uuidv4().substring(0, 8).toUpperCase()
        });
        await transaction.save();
        
        res.json({
            success: true,
            message: 'MTN transfer initiated',
            transaction
        });
        
    } catch (error) {
        console.error('MTN error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== Orange Money (West Africa) - REAL ====================
router.post('/orange', auth, async (req, res) => {
    try {
        const { phone, amount, country } = req.body; // CI, SN, ML, BF, etc.
        
        const user = await User.findById(req.userId);
        
        // REAL Orange Money API
        const orangeResponse = await axios.post(`${process.env.ORANGE_API_URL}/orange-money-web/api/v1/transfer`, {
            amount: amount,
            currency: 'XOF',
            receiverPhoneNumber: phone,
            description: 'QuantumPay Transfer'
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.ORANGE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        // Deduct from user balance (convert XOF to user's currency)
        user.balances.USD -= amount / 600; // Approx conversion
        await user.save();
        
        const transaction = new Transaction({
            userId: user._id,
            type: 'send',
            amount,
            currency: 'XOF',
            mobileProvider: 'Orange Money',
            mobileNumber: phone,
            status: 'processing',
            reference: 'ORN-' + uuidv4().substring(0, 8).toUpperCase()
        });
        await transaction.save();
        
        res.json({
            success: true,
            message: 'Orange Money transfer initiated',
            transaction
        });
        
    } catch (error) {
        console.error('Orange Money error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== Airtel Money (Africa Wide) - REAL ====================
router.post('/airtel', auth, async (req, res) => {
    try {
        const { phone, amount, country } = req.body;
        
        const user = await User.findById(req.userId);
        
        // REAL Airtel API
        const airtelResponse = await axios.post(`${process.env.AIRTEL_API_URL}/merchant/v1/payments`, {
            reference: Date.now().toString(),
            sub: {
                name: 'QuantumPay',
                msisdn: phone,
                country: country,
                currency: country === 'KE' ? 'KES' : country === 'UG' ? 'UGX' : 'TZS',
                amount: amount
            }
        }, {
            headers: {
                'X-Country': country,
                'X-Currency': country === 'KE' ? 'KES' : country === 'UG' ? 'UGX' : 'TZS',
                'Authorization': `Bearer ${process.env.AIRTEL_TOKEN}`
            }
        });
        
        const currency = country === 'KE' ? 'KES' : country === 'UG' ? 'UGX' : 'TZS';
        
        user.balances[currency] -= amount;
        await user.save();
        
        const transaction = new Transaction({
            userId: user._id,
            type: 'send',
            amount,
            currency,
            mobileProvider: 'Airtel Money',
            mobileNumber: phone,
            status: 'processing',
            reference: 'AIR-' + uuidv4().substring(0, 8).toUpperCase()
        });
        await transaction.save();
        
        res.json({
            success: true,
            message: 'Airtel Money transfer initiated',
            transaction
        });
        
    } catch (error) {
        console.error('Airtel error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
