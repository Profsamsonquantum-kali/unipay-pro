const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
    // Create payment intent
    async createPaymentIntent(amount, currency, metadata = {}) {
        return await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: currency.toLowerCase(),
            metadata,
            automatic_payment_methods: { enabled: true }
        });
    }

    // Create customer
    async createCustomer(email, name, metadata = {}) {
        return await stripe.customers.create({
            email,
            name,
            metadata
        });
    }

    // Create card for customer
    async createCard(customerId, paymentMethodId) {
        return await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId
        });
    }

    // Create payout
    async createPayout(amount, currency, destination) {
        return await stripe.payouts.create({
            amount: Math.round(amount * 100),
            currency: currency.toLowerCase(),
            destination
        });
    }

    // Create transfer
    async createTransfer(amount, currency, destination) {
        return await stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency: currency.toLowerCase(),
            destination
        });
    }

    // Create virtual card (via Stripe Issuing)
    async createVirtualCard(cardholderId, currency, limits = {}) {
        return await stripe.issuing.cards.create({
            currency: currency.toLowerCase(),
            type: 'virtual',
            status: 'active',
            cardholder: cardholderId,
            spending_controls: {
                spending_limits: limits.spendingLimits || []
            }
        });
    }

    // Create cardholder
    async createCardholder(user) {
        return await stripe.issuing.cardholders.create({
            type: 'individual',
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone_number: user.phone,
            billing: {
                address: {
                    line1: '123 Main St', // Should come from user profile
                    city: 'Nairobi',
                    country: 'KE'
                }
            }
        });
    }

    // Get balance
    async getBalance() {
        return await stripe.balance.retrieve();
    }

    // Handle webhook
    async handleWebhook(rawBody, signature) {
        const event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        return event;
    }
}

module.exports = new StripeService();