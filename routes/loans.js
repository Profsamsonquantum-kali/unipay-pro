const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Loan = require('../models/Loan');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Apply for loan
router.post('/apply', auth, async (req, res) => {
    try {
        const { amount, currency, term, purpose } = req.body;

        // Calculate interest (simple example)
        const interestRate = 0.05; // 5%
        const totalInterest = amount * interestRate * term;
        const totalRepayment = amount + totalInterest;
        const monthlyPayment = totalRepayment / (term * 12);

        // Create loan
        const loan = new Loan({
            userId: req.userId,
            loanId: 'LN' + uuidv4().substring(0, 8).toUpperCase(),
            amount,
            currency,
            interestRate,
            term,
            purpose,
            monthlyPayment,
            totalRepayment,
            remainingBalance: totalRepayment,
            nextPayment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });

        await loan.save();

        // Add to user's loans
        await User.findByIdAndUpdate(req.userId, {
            $push: { loans: loan }
        });

        // Credit user account
        await User.findByIdAndUpdate(req.userId, {
            $inc: { [`balances.${currency}`]: amount }
        });

        // Create transaction
        const transaction = new Transaction({
            userId: req.userId,
            type: 'loan',
            amount,
            currency,
            description: `Loan disbursement - ${loan.loanId}`,
            status: 'completed',
            reference: 'LN-' + uuidv4().substring(0, 8).toUpperCase(),
            completedAt: new Date()
        });
        await transaction.save();

        res.json({
            success: true,
            loan,
            transaction
        });

    } catch (error) {
        console.error('Loan application error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user loans
router.get('/', auth, async (req, res) => {
    try {
        const loans = await Loan.find({ userId: req.userId });
        res.json({ success: true, loans });
    } catch (error) {
        console.error('Get loans error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Make loan payment
router.post('/:loanId/pay', auth, async (req, res) => {
    try {
        const { loanId } = req.params;
        const { amount } = req.body;

        const loan = await Loan.findOne({ loanId, userId: req.userId });
        if (!loan) {
            return res.status(404).json({ error: 'Loan not found' });
        }

        // Check user balance
        const user = await User.findById(req.userId);
        if (user.balances[loan.currency] < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct from user
        user.balances[loan.currency] -= amount;
        await user.save();

        // Update loan
        loan.remainingBalance -= amount;
        loan.payments.push({
            amount,
            date: new Date(),
            transactionId: 'PMT-' + uuidv4().substring(0, 8).toUpperCase()
        });

        if (loan.remainingBalance <= 0) {
            loan.status = 'paid';
        }

        await loan.save();

        // Create transaction
        const transaction = new Transaction({
            userId: req.userId,
            type: 'loan-payment',
            amount,
            currency: loan.currency,
            description: `Loan payment for ${loan.loanId}`,
            status: 'completed',
            reference: 'PMT-' + uuidv4().substring(0, 8).toUpperCase(),
            completedAt: new Date()
        });
        await transaction.save();

        res.json({
            success: true,
            loan,
            transaction
        });

    } catch (error) {
        console.error('Loan payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;