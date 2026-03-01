const plaid = require('plaid');

class PlaidService {
    constructor() {
        this.client = new plaid.Client({
            clientID: process.env.PLAID_CLIENT_ID,
            secret: process.env.PLAID_SECRET,
            env: plaid.environments[process.env.PLAID_ENV || 'sandbox']
        });
    }

    // Create link token
    async createLinkToken(userId) {
        const response = await this.client.linkTokenCreate({
            user: { client_user_id: userId.toString() },
            client_name: 'QuantumPay',
            products: ['auth', 'transactions'],
            country_codes: ['US', 'CA', 'GB', 'KE', 'NG', 'ZA'],
            language: 'en'
        });
        return response.link_token;
    }

    // Exchange public token for access token
    async exchangePublicToken(publicToken) {
        const response = await this.client.itemPublicTokenExchange(publicToken);
        return {
            accessToken: response.access_token,
            itemId: response.item_id
        };
    }

    // Get accounts
    async getAccounts(accessToken) {
        const response = await this.client.accountsGet({ access_token: accessToken });
        return response.accounts;
    }

    // Get auth data (routing numbers)
    async getAuth(accessToken) {
        const response = await this.client.authGet({ access_token: accessToken });
        return response.numbers;
    }

    // Get transactions
    async getTransactions(accessToken, startDate, endDate) {
        const response = await this.client.transactionsGet({
            access_token: accessToken,
            start_date: startDate,
            end_date: endDate,
            options: { count: 500 }
        });
        return response.transactions;
    }

    // Get balance
    async getBalance(accessToken) {
        const response = await this.client.accountsBalanceGet({
            access_token: accessToken
        });
        return response.accounts;
    }

    // Remove item
    async removeItem(accessToken) {
        await this.client.itemRemove({ access_token: accessToken });
    }
}

module.exports = new PlaidService();