const stripe = require('stripe');

// Initialize Stripe with secret key from environment variables
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

module.exports = stripeClient;
