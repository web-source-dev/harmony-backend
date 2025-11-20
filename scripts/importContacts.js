const mongoose = require('mongoose');
const Customer = require('../models/customer');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/harmony');
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Contact data organized by categories
const contactsData = {
    hostSiteRegistrationPartnership: [
        {
            firstName: 'Chaveli',
            lastName: 'De Leon',
            email: 'chaveli@gurlstalk.com',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Ester',
            lastName: 'Abramovich',
            email: 'Eabramovich@SIJCC.COM',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Mikal',
            lastName: 'Magori',
            email: 'mmagori@sijcc.com',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Gena',
            lastName: 'Jefferson',
            email: 'gena@jaiayouth.org',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Valerie',
            lastName: 'Herman',
            email: 'vherman@bu.edu',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Chris',
            lastName: 'Smith',
            email: 'aosmith@cchr.nyc.gov',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Kailyn',
            lastName: 'Fox',
            email: 'kfox8@schools.nyc.gov',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Rodney',
            lastName: 'Rojas Quiroz',
            email: 'rrojasquiroz@schools.nyc.gov',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Hana',
            lastName: 'Epstein',
            email: 'HEpstein3@schools.nyc.gov',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Kerisha',
            lastName: '',
            email: 'kerisha@streetsquash.org',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Kylie',
            lastName: '',
            email: 'kylie@streetsquash.org',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Stefany',
            lastName: '',
            email: 'stefany@streetsquash.org',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Jen',
            lastName: '',
            email: 'jen@streetsquash.org',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Gmelendez',
            lastName: '',
            email: 'gmelendez@eastbronxacademy.org',
            labels: ['host-site-registration', 'partnership-agreement']
        },
        {
            firstName: 'Aleeyah',
            lastName: '',
            email: 'aleeyah@jaiayouth.org',
            labels: ['host-site-registration', 'partnership-agreement']
        }
    ],
    additionalContacts: [
        {
            firstName: 'Carmen',
            lastName: 'Merville',
            email: 'cmerville@venturehouse.org',
            labels: ['general-contact']
        },
        {
            firstName: 'Director Seniorcenter',
            lastName: '',
            email: 'director.seniorcenter@zzalphas.org',
            labels: ['general-contact']
        },
        {
            firstName: 'HerCare',
            lastName: '',
            email: 'hercare@hercareinc.org',
            labels: ['general-contact']
        },
        {
            firstName: 'Info',
            lastName: '',
            email: 'info@queensjazz.com',
            labels: ['general-contact']
        },
        {
            firstName: 'Kim',
            lastName: '',
            email: 'kim@theconnectedchef.org',
            labels: ['general-contact']
        },
        {
            firstName: 'Maribel',
            lastName: '',
            email: 'maribel@zionsmission.org',
            labels: ['general-contact']
        },
        {
            firstName: 'Mariella',
            lastName: '',
            email: 'mariella@rifnyc.org',
            labels: ['general-contact']
        },
        {
            firstName: 'Maria',
            lastName: 'Moraga',
            email: 'mmoraga@nynice.org',
            labels: ['general-contact']
        },
        {
            firstName: 'NBO Outreach',
            lastName: '',
            email: 'nbo_outreach@aol.com',
            labels: ['general-contact']
        },
        {
            firstName: 'Networks Master Calendar',
            lastName: '',
            email: '',
            labels: ['general-contact']
        },
        {
            firstName: 'Nextkey Foundation',
            lastName: '',
            email: 'nextkeyfoundation@gmail.com',
            labels: ['general-contact']
        },
        {
            firstName: 'Raveen',
            lastName: 'Seaton',
            email: 'raveenseaton@gmail.com',
            labels: ['general-contact']
        }
    ]
};

// Function to import contacts
const importContacts = async () => {
    try {
        console.log('Starting contact import...');
        
        let totalImported = 0;
        let totalSkipped = 0;
        
        // Process each category
        for (const [category, contacts] of Object.entries(contactsData)) {
            console.log(`\nProcessing ${category} contacts...`);
            
            for (const contact of contacts) {
                try {
                    // Check if contact already exists
                    const existingContact = await Customer.findOne({ email: contact.email });
                    
                    if (existingContact) {
                        console.log(`Skipping existing contact: ${contact.email}`);
                        totalSkipped++;
                        continue;
                    }
                    
                    // Create new contact
                    const newContact = new Customer({
                        ...contact,
                        isSubscribed: true,
                        subscribedAt: new Date(),
                        lastActivity: new Date(),
                        lastActivityDate: new Date()
                    });
                    
                    await newContact.save();
                    console.log(`✓ Imported: ${contact.firstName} ${contact.lastName} (${contact.email})`);
                    totalImported++;
                    
                } catch (error) {
                    console.error(`Error importing ${contact.email}:`, error.message);
                }
            }
        }
        
        console.log(`\n=== Import Summary ===`);
        console.log(`Total imported: ${totalImported}`);
        console.log(`Total skipped: ${totalSkipped}`);
        console.log(`Total processed: ${totalImported + totalSkipped}`);
        
        // Display category breakdown
        console.log(`\n=== Category Breakdown ===`);
        for (const [category, contacts] of Object.entries(contactsData)) {
            console.log(`${category}: ${contacts.length} contacts`);
        }
        
    } catch (error) {
        console.error('Import error:', error);
    }
};

// Main execution
const main = async () => {
    await connectDB();
    
    await importContacts();
    
    console.log('\nImport process completed!');
    process.exit(0);
};

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('Script error:', error);
        process.exit(1);
    });
}

module.exports = { importContacts };
