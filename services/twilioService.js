const twilio = require('twilio');

class TwilioService {
    constructor() {
        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
        this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    }

    async sendSMS(to, message) {
        try {
            const options = {
                body: message,
                to
            };

            if (this.messagingServiceSid) {
                options.messagingServiceSid = this.messagingServiceSid;
            } else if (this.fromNumber) {
                options.from = this.fromNumber;
            } else {
                throw new Error('No SMS sender configured');
            }

            const result = await this.client.messages.create(options);
            console.log(`📱 SMS sent: ${result.sid} to ${to}`);
            return { success: true, sid: result.sid };
        } catch (error) {
            console.error('❌ SMS error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendVerificationCode(to, code) {
        const message = `🔐 Your QuantumPay verification code is: ${code}. Valid for 10 minutes.`;
        return this.sendSMS(to, message);
    }

    async sendLoginCode(to, code) {
        const message = `🔑 Your QuantumPay login code is: ${code}. Do not share this code.`;
        return this.sendSMS(to, message);
    }

    async sendTransactionNotification(to, type, amount, currency) {
        const messages = {
            send: `💸 You sent ${currency} ${amount} via QuantumPay`,
            receive: `💰 You received ${currency} ${amount} via QuantumPay`,
            deposit: `📥 Deposit of ${currency} ${amount} completed`,
            withdrawal: `📤 Withdrawal of ${currency} ${amount} initiated`
        };
        return this.sendSMS(to, messages[type] || 'QuantumPay transaction');
    }

    async sendSecurityAlert(to, alert) {
        const message = `⚠️ Security Alert: ${alert}. If this wasn't you, contact support.`;
        return this.sendSMS(to, message);
    }

    async sendWelcomeMessage(to, name) {
        const message = `🎉 Welcome to QuantumPay, ${name}! Your account is ready.`;
        return this.sendSMS(to, message);
    }
}

module.exports = new TwilioService();