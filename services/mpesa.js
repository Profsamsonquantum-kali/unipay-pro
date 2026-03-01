const axios = require('axios');

class MpesaService {
    constructor() {
        this.baseURL = process.env.MPESA_API_URL;
        this.consumerKey = process.env.MPESA_CONSUMER_KEY;
        this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
        this.passkey = process.env.MPESA_PASSKEY;
        this.shortCode = process.env.MPESA_SHORTCODE;
    }

    // Get access token
    async getAccessToken() {
        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
        
        const response = await axios.get(
            `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
            { headers: { Authorization: `Basic ${auth}` } }
        );
        
        return response.data.access_token;
    }

    // STK Push (Customer initiates payment)
    async stkPush(phone, amount, accountReference) {
        const token = await this.getAccessToken();
        const timestamp = this.getTimestamp();
        const password = Buffer.from(
            `${this.shortCode}${this.passkey}${timestamp}`
        ).toString('base64');

        const response = await axios.post(
            `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
            {
                BusinessShortCode: this.shortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: amount,
                PartyA: phone,
                PartyB: this.shortCode,
                PhoneNumber: phone,
                CallBackURL: `${process.env.BASE_URL}/api/webhooks/mpesa`,
                AccountReference: accountReference,
                TransactionDesc: 'QuantumPay Payment'
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }

    // Business to Customer (Send money to customer)
    async b2c(phone, amount, remarks) {
        const token = await this.getAccessToken();

        const response = await axios.post(
            `${this.baseURL}/mpesa/b2c/v1/paymentrequest`,
            {
                InitiatorName: process.env.MPESA_INITIATOR,
                SecurityCredential: process.env.MPESA_CREDENTIAL,
                CommandID: 'BusinessPayment',
                Amount: amount,
                PartyA: this.shortCode,
                PartyB: phone,
                Remarks: remarks,
                QueueTimeOutURL: `${process.env.BASE_URL}/api/webhooks/mpesa/timeout`,
                ResultURL: `${process.env.BASE_URL}/api/webhooks/mpesa/result`
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }

    // Query transaction status
    async queryStatus(transactionId) {
        const token = await this.getAccessToken();
        const timestamp = this.getTimestamp();
        const password = Buffer.from(
            `${this.shortCode}${this.passkey}${timestamp}`
        ).toString('base64');

        const response = await axios.post(
            `${this.baseURL}/mpesa/stkpushquery/v1/query`,
            {
                BusinessShortCode: this.shortCode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: transactionId
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }

    // Get timestamp in required format
    getTimestamp() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }
}

module.exports = new MpesaService();