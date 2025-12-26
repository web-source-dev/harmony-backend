const Customer = require('../models/customer');

/**
 * Automatically create a customer if the email doesn't already exist
 * @param {Object} customerData - Customer data object
 * @param {string} customerData.email - Customer email (required)
 * @param {string} [customerData.firstName] - Customer first name
 * @param {string} [customerData.lastName] - Customer last name
 * @param {string} [customerData.phone] - Customer phone number
 * @param {string} [customerData.address] - Customer address
 * @param {boolean} [customerData.isSubscribed=true] - Whether customer is subscribed
 * @param {boolean} [customerData.smsConsent] - Whether customer consented to SMS updates
 * @param {string} [customerData.source] - Source of the customer (e.g., 'website', 'text-updates')
 * @returns {Promise<Object|null>} - Returns the created customer or null if already exists
 */
async function createCustomerIfNotExists(customerData) {
    try {
        const { email, firstName, lastName, phone, address, isSubscribed = true, smsConsent, source = 'website' } = customerData;
        
        // Validate email
        if (!email) {
            console.error('Customer creation failed: Email is required');
            return null;
        }

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({ email: email.toLowerCase().trim() });
        if (existingCustomer) {
            console.log(`Customer with email ${email} already exists, skipping creation`);
            return existingCustomer;
        }

        // Create new customer
        const customer = new Customer({
            firstName: firstName ? firstName.trim() : '',
            lastName: lastName ? lastName.trim() : '',
            email: email.toLowerCase().trim(),
            phone: phone ? phone.trim() : '',
            address: address ? address.trim() : '',
            isSubscribed: isSubscribed,
            emailSubscriberStatus: 'subscribed',
            smsSubscriberStatus: 'subscribed',
            subscribedAt: new Date(),
            source: source
        });

        await customer.save();
        console.log(`New customer created for email: ${email}`);
        return customer;

    } catch (error) {
        console.error('Error creating customer:', error);
        return null;
    }
}

module.exports = {
    createCustomerIfNotExists
};
