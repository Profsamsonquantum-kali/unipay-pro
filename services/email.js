const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // Send email
    async sendEmail(to, subject, html) {
        try {
            const info = await this.transporter.sendMail({
                from: `"QuantumPay" <${process.env.SMTP_FROM}>`,
                to,
                subject,
                html
            });
            console.log('Email sent:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email error:', error);
            return { success: false, error: error.message };
        }
    }

    // Welcome email
    async sendWelcomeEmail(user) {
        const html = `
            <h1>Welcome to QuantumPay, ${user.firstName}!</h1>
            <p>Your account has been successfully created.</p>
            <p>You can now send money, trade crypto, and more.</p>
            <p>Get started: <a href="${process.env.BASE_URL}/dashboard">Go to Dashboard</a></p>
        `;
        return await this.sendEmail(user.email, 'Welcome to QuantumPay!', html);
    }

    // Password reset email
    async sendPasswordResetEmail(email, resetToken) {
        const resetLink = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;
        const html = `
            <h1>Password Reset Request</h1>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `;
        return await this.sendEmail(email, 'Password Reset - QuantumPay', html);
    }

    // Transaction notification
    async sendTransactionEmail(user, transaction) {
        const type = transaction.type.toUpperCase();
        const html = `
            <h1>Transaction ${type}</h1>
            <p>Amount: ${transaction.currency} ${transaction.amount}</p>
            <p>Reference: ${transaction.reference}</p>
            <p>Status: ${transaction.status}</p>
            <p>Date: ${new Date(transaction.createdAt).toLocaleString()}</p>
        `;
        return await this.sendEmail(
            user.email,
            `Transaction ${type} - QuantumPay`,
            html
        );
    }

    // Security alert
    async sendSecurityAlert(user, alert) {
        const html = `
            <h1>Security Alert</h1>
            <p>${alert.message}</p>
            <p>Time: ${new Date().toLocaleString()}</p>
            <p>IP: ${alert.ip}</p>
            <p>Device: ${alert.device}</p>
            <p>If this wasn't you, please contact support immediately.</p>
        `;
        return await this.sendEmail(user.email, 'Security Alert - QuantumPay', html);
    }
}

module.exports = new EmailService();