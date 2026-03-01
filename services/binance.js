const Binance = require('binance-api-node').default;

class BinanceService {
    constructor() {
        this.client = Binance({
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_SECRET_KEY
        });
    }

    // Get account info
    async getAccountInfo() {
        return await this.client.accountInfo();
    }

    // Get prices
    async getPrices() {
        return await this.client.prices();
    }

    // Get 24hr stats
    async get24hrStats(symbol) {
        return await this.client.dailyStats({ symbol });
    }

    // Place market buy order
    async marketBuy(symbol, quoteOrderQty) {
        return await this.client.order({
            symbol,
            side: 'BUY',
            type: 'MARKET',
            quoteOrderQty
        });
    }

    // Place market sell order
    async marketSell(symbol, quantity) {
        return await this.client.order({
            symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity
        });
    }

    // Place limit order
    async limitOrder(symbol, side, quantity, price) {
        return await this.client.order({
            symbol,
            side,
            type: 'LIMIT',
            quantity,
            price,
            timeInForce: 'GTC'
        });
    }

    // Get order book
    async getOrderBook(symbol, limit = 100) {
        return await this.client.book({ symbol, limit });
    }

    // Get candlestick data
    async getCandles(symbol, interval = '1h', limit = 100) {
        return await this.client.candles({ symbol, interval, limit });
    }

    // Get account balance
    async getBalance() {
        const account = await this.client.accountInfo();
        return account.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
    }

    // Get deposit history
    async getDepositHistory(asset) {
        return await this.client.depositHistory({ asset });
    }

    // Get withdraw history
    async getWithdrawHistory(asset) {
        return await this.client.withdrawHistory({ asset });
    }

    // Withdraw crypto
    async withdraw(asset, address, amount, network) {
        return await this.client.withdraw({
            asset,
            address,
            amount,
            network
        });
    }
}

module.exports = new BinanceService();