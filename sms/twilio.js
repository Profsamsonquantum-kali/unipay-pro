// sms/twilio.js
const twilio = require('twilio');

// Initialize Twilio client with environment variables
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send SMS message
 * @param {string} to - Recipient phone number
 * @param {string} message - Message content
 * @returns {Promise} - Twilio message object
 */
const sendSMS = async (to, message) => {
  try {
    // Validate inputs
    if (!to || !message) {
      throw new Error('Phone number and message are required');
    }

    // Send message
    const result = await client.messages.create({
      body: message,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    console.log(`SMS sent to ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    console.error('SMS sending failed:', error);
    throw error;
  }
};

/**
 * Send verification code
 * @param {string} to - Recipient phone number
 * @param {string} code - Verification code
 * @returns {Promise}
 */
const sendVerificationCode = async (to, code) => {
  const message = `Your QuantumPay verification code is: ${code}`;
  return sendSMS(to, message);
};

/**
 * Send transaction alert
 * @param {string} to - Recipient phone number
 * @param {string} amount - Transaction amount
 * @param {string} type - Transaction type
 * @returns {Promise}
 */
const sendTransactionAlert = async (to, amount, type) => {
  const message = `QuantumPay: ${type} of $${amount} completed on your account.`;
  return sendSMS(to, message);
};

module.exports = {
  sendSMS,
  sendVerificationCode,
  sendTransactionAlert
};
