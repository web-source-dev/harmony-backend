const Customer = require('../models/customer');
const { getUSPhoneError } = require('../utils/usPhone');
const { getEmailFormatError, getEmailDeliverabilityError, isValidEmailFormat } = require('../utils/email');

async function validateRequiredCustomerFields({ firstName, lastName, email, phone, phone1, phone2 }) {
    const errors = [];

    if (!firstName?.trim()) {
        errors.push('First name is required');
    }
    if (!lastName?.trim()) {
        errors.push('Last name is required');
    }
    const emailError = getEmailFormatError(email) || await getEmailDeliverabilityError(email);
    if (emailError) {
        errors.push(emailError);
    }

    const [phoneError, phone1Error, phone2Error] = await Promise.all([
        getUSPhoneError(phone, { required: true }),
        getUSPhoneError(phone1),
        getUSPhoneError(phone2),
    ]);
    if (phoneError) errors.push(phoneError);
    if (phone1Error) errors.push(`Phone 1: ${phone1Error}`);
    if (phone2Error) errors.push(`Phone 2: ${phone2Error}`);

    return errors;
}

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
        if (!email || !isValidEmailFormat(email)) {
            console.error('Customer creation failed: a valid email is required');
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
    createCustomerIfNotExists,
    validateRequiredCustomerFields
};
