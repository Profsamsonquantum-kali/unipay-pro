// sms/twilio.js
let client = null;

// Only initialize Twilio if credentials are provided
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log('✅ Twilio initialized');
} else {
  console.log('⚠️ Twilio credentials not found - SMS disabled');
}

/**
 * Send SMS message
 * @param {string} to - Recipient phone number
 * @param {string} message - Message content
 * @returns {Promise} - Twilio message object
 */
const sendSMS = async (to, message) => {
  // If Twilio is not configured, just mock it
  if (!client) {
    console.log(`📱 [MOCK] SMS to ${to}: ${message}`);
    return { sid: 'mock_sid', status: 'delivered' };
  }

  try {
    // Validate inputs
    if (!to || !message) {
      throw new Error('Phone number and message are required');
    }

    // Check if phone number is configured
    if (!process.env.TWILIO_PHONE_NUMBER) {
      throw new Error('TWILIO_PHONE_NUMBER is not set in environment variables');
    }

    // Send message
    const result = await client.messages.create({
      body: message,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    console.log(`✅ SMS sent to ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    console.error('❌ SMS sending failed:', error.message);
    // Don't throw error in mock mode - just log it
    if (!client) {
      console.log('📱 [MOCK] SMS would have failed but continuing');
      return { sid: 'mock_failed', status: 'mock' };
    }
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

// Export all functions at the END (after they're defined)
module.exports = {
  sendSMS,
  sendVerificationCode,
  sendTransactionAlert
};
