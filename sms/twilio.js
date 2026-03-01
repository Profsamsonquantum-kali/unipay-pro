// Mock Twilio service (no actual SMS required)
class SMSService {
    async sendVerificationCode(to, code) {
        console.log(`📱 [SIMULATED] SMS to ${to}: Your verification code is ${code}`);
        return { success: true, simulated: true };
    }

    async sendLoginCode(to, code) {
        console.log(`📱 [SIMULATED] SMS to ${to}: Your login code is ${code}`);
        return { success: true, simulated: true };
    }

    async sendTransactionNotification(to, type, amount, currency) {
        console.log(`📱 [SIMULATED] SMS to ${to}: ${type} ${amount} ${currency}`);
        return { success: true, simulated: true };
    }
}

module.exports = new SMSService();
