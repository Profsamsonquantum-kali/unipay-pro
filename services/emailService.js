const nodemailer = require('nodemailer');
const { welcomeEmail, passwordResetEmail } = require('../utils/emailTemplates');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    async sendEmail(to, subject, html) {
        try {
            const mailOptions = {
                from: `"QuantumPay" <${process.env.SMTP_FROM}>`,
                to,
                subject,
                html
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Email sent: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Email error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendWelcomeEmail(to, name) {
        return this.sendEmail(
            to,
            'Welcome to QuantumPay! 🎉',
            welcomeEmail(name)
        );
    }

    async sendVerificationEmail(to, token) {
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${token}`;
        return this.sendEmail(
            to,
            'Verify Your Email - QuantumPay',
            `
                <h1>Verify Your Email</h1>
                <p>Click the link below to verify your email address:</p>
                <a href="${verificationUrl}">${verificationUrl}</a>
                <p>This link expires in 24 hours.</p>
            `
        );
    }

    async sendPasswordResetEmail(to, token) {
        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
        return this.sendEmail(
            to,
            'Password Reset - QuantumPay',
            passwordResetEmail(resetUrl)
        );
    }

    async sendTransactionNotification(to, transaction) {
        return this.sendEmail(
            to,
            `Transaction ${transaction.type.toUpperCase()} - QuantumPay`,
            `
                <h1>Transaction ${transaction.type}</h1>
                <p><strong>Amount:</strong> ${transaction.currency} ${transaction.amount}</p>
                <p><strong>Status:</strong> ${transaction.status}</p>
                <p><strong>Reference:</strong> ${transaction.reference}</p>
                <p><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString()}</p>
            `
        );
    }

    async sendSecurityAlert(to, alert) {
        return this.sendEmail(
            to,
            'Security Alert - QuantumPay',
            `
                <h1>Security Alert</h1>
                <p>${alert.message}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>IP Address:</strong> ${alert.ip}</p>
                <p><strong>Device:</strong> ${alert.device}</p>
                <p>If this wasn't you, please contact support immediately.</p>
            `
        );
    }
}

module.exports = new EmailService();