const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const apiFeatures = require('../utils/apiFeatures');

// Get current user
exports.getMe = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.userId)
        .select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken -passwordResetExpires')
        .populate('bankAccounts')
        .populate('cards')
        .populate('loans')
        .populate('investments');

    res.status(200).json({
        status: 'success',
        data: { user }
    });
});

// Update current user
exports.updateMe = catchAsync(async (req, res, next) => {
    // Prevent password update on this route
    if (req.body.password || req.body.passwordConfirm) {
        return next(new AppError('This route is not for password updates. Please use /update-password', 400));
    }

    const filteredBody = filterObj(req.body, 'firstName', 'lastName', 'email', 'phone', 'address');

    const updatedUser = await User.findByIdAndUpdate(req.userId, filteredBody, {
        new: true,
        runValidators: true
    }).select('-password -emailVerificationToken -phoneVerificationCode');

    res.status(200).json({
        status: 'success',
        data: { user: updatedUser }
    });
});

// Delete current user
exports.deleteMe = catchAsync(async (req, res, next) => {
    await User.findByIdAndUpdate(req.userId, { active: false });

    res.status(204).json({
        status: 'success',
        data: null
    });
});

// Get user transactions
exports.getMyTransactions = catchAsync(async (req, res, next) => {
    const features = new apiFeatures(Transaction.find({ userId: req.userId }), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

    const transactions = await features.query;

    res.status(200).json({
        status: 'success',
        results: transactions.length,
        data: { transactions }
    });
});

// Get user balance summary
exports.getBalance = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.userId).select('balances crypto');

    // Calculate total in USD (simplified)
    const rates = {
        USD: 1,
        EUR: 1.08,
        GBP: 1.27,
        KES: 0.0066,
        NGN: 0.00065,
        ZAR: 0.053,
        BTC: 51234.50,
        ETH: 3123.45
    };

    let totalUSD = 0;
    
    // Fiat totals
    Object.entries(user.balances).forEach(([currency, amount]) => {
        totalUSD += amount * (rates[currency] || 1);
    });

    // Crypto totals
    Object.entries(user.crypto).forEach(([currency, amount]) => {
        totalUSD += amount * (rates[currency] || 0);
    });

    res.status(200).json({
        status: 'success',
        data: {
            balances: user.balances,
            crypto: user.crypto,
            totalUSD
        }
    });
});

// Helper function to filter object
const filterObj = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
        if (allowedFields.includes(el)) newObj[el] = obj[el];
    });
    return newObj;
};