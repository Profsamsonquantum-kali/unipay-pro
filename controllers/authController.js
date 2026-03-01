const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const emailService = require('../services/emailService');
const twilioService = require('../services/twilioService');

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

const createSendToken = (user, statusCode, req, res) => {
    const token = signToken(user._id);

    // Remove password from output
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                country: user.country,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified,
                createdAt: user.createdAt
            }
        }
    });
};

// Register new user
exports.register = catchAsync(async (req, res, next) => {
    const { firstName, lastName, email, phone, country, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
        return next(new AppError('User already exists with this email or phone', 400));
    }

    // Generate verification codes
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const phoneVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user
    const user = await User.create({
        firstName,
        lastName,
        email,
        phone,
        country,
        password,
        emailVerificationToken,
        phoneVerificationCode,
        phoneVerificationExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Send verification email
    try {
        await emailService.sendVerificationEmail(user.email, emailVerificationToken);
    } catch (err) {
        console.error('Email sending failed:', err);
    }

    // Send verification SMS
    try {
        await twilioService.sendVerificationCode(user.phone, phoneVerificationCode);
    } catch (err) {
        console.error('SMS sending failed:', err);
    }

    createSendToken(user, 201, req, res);
});

// Login
exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }

    // Check if user exists && password is correct
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    createSendToken(user, 200, req, res);
});

// Verify email
exports.verifyEmail = catchAsync(async (req, res, next) => {
    const { token } = req.params;

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
        return next(new AppError('Invalid or expired verification token', 400));
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Email verified successfully'
    });
});

// Verify phone
exports.verifyPhone = catchAsync(async (req, res, next) => {
    const { code } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    if (user.phoneVerificationCode !== code || user.phoneVerificationExpires < Date.now()) {
        return next(new AppError('Invalid or expired verification code', 400));
    }

    user.isPhoneVerified = true;
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
        status: 'success',
        message: 'Phone verified successfully'
    });
});

// Resend verification code
exports.resendCode = catchAsync(async (req, res, next) => {
    const { phone } = req.body;

    const user = await User.findOne({ phone });

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    // Generate new code
    const phoneVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.phoneVerificationCode = phoneVerificationCode;
    user.phoneVerificationExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    // Send SMS
    await twilioService.sendVerificationCode(user.phone, phoneVerificationCode);

    res.status(200).json({
        status: 'success',
        message: 'Verification code resent'
    });
});

// Forgot password
exports.forgotPassword = catchAsync(async (req, res, next) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return next(new AppError('There is no user with this email address', 404));
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send email
    try {
        await emailService.sendPasswordResetEmail(user.email, resetToken);

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email'
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(new AppError('There was an error sending the email. Try again later.', 500));
    }
});

// Reset password
exports.resetPassword = catchAsync(async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    createSendToken(user, 200, req, res);
});

// Update password
exports.updatePassword = catchAsync(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId).select('+password');

    if (!(await user.correctPassword(currentPassword, user.password))) {
        return next(new AppError('Your current password is wrong', 401));
    }

    user.password = newPassword;
    await user.save();

    createSendToken(user, 200, req, res);
});

// Logout
exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    
    res.status(200).json({ status: 'success' });
};