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
    government: [
        {
            firstName: 'Alicia',
            lastName: 'L. Hyndman',
            email: 'Aliciaforassemby@42813393.mailchimpapp.com',
            position: 'Assemblywoman',
            labels: ['government', 'assembly', 'political'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Erik',
            lastName: 'Bottcher',
            email: 'district3@council.nyc.gov',
            position: 'Council Member',
            labels: ['government', 'council', 'nyc'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Hanif',
            lastName: 'Council Member',
            email: 'district39@council.nyc.gov',
            position: 'Council Member',
            labels: ['government', 'council', 'nyc'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Gregory',
            lastName: 'Meeks',
            email: 'repmeeks@mail8.housecommunications.gov',
            position: 'Representative',
            labels: ['government', 'congress', 'federal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Kirsten',
            lastName: 'Gillibrand',
            email: 'senator@Gillibrand.senate.gov',
            position: 'Senator',
            labels: ['government', 'senate', 'federal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Susan',
            lastName: 'Tanenbaum',
            email: 'stanenbaum@queensbp.nyc.gov',
            position: 'Queens Borough President',
            labels: ['government', 'borough_president', 'queens'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Team',
            lastName: 'Ossé',
            email: 'chiosse@nyccouncil.ccsend.com',
            position: 'NYC Council',
            labels: ['government', 'council', 'team'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        }
    ],
    nonprofit: [
        {
            firstName: 'Aisha',
            lastName: 'McGainey',
            email: 'mcgaineya@gmail.com',
            labels: ['nonprofit', 'individual'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Amber Melanie',
            lastName: 'Smith',
            email: 'amber@ambermsmith.com',
            labels: ['nonprofit', 'individual'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Anuj',
            lastName: 'Garg',
            email: 'anuj@webincline.com',
            position: 'Web Developer',
            labels: ['nonprofit', 'business', 'web_services'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Emily',
            lastName: 'Kerr',
            email: 'emily@catalystnonprofitcoaching.com',
            position: 'Nonprofit Coach',
            labels: ['nonprofit', 'coaching', 'consulting'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Fabiana',
            lastName: 'Claure',
            email: 'fabiana@lc.fabianaclaure.com',
            labels: ['nonprofit', 'individual'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Feruze Khadija Ashki',
            lastName: 'Karim',
            email: 'feruzefaison@gmail.com',
            labels: ['nonprofit', 'individual'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Joan',
            lastName: 'Garry',
            email: 'joan@joangarry.com',
            position: 'Nonprofit Leadership Expert',
            labels: ['nonprofit', 'leadership', 'consulting'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Joan',
            lastName: 'Garry',
            email: 'joangarry@nonprofitleadershiplab.com',
            position: 'Nonprofit Leadership Lab',
            labels: ['nonprofit', 'leadership', 'lab'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Katherine S.',
            lastName: 'Boswell',
            email: 'ksboswell@kresge.org',
            position: 'Kresge Foundation',
            labels: ['nonprofit', 'foundation', 'funding'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Mardi Gras',
            lastName: 'Productions',
            email: 'mardigras@nycstreetfairs.com',
            position: 'Event Production',
            labels: ['nonprofit', 'events', 'production'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'NYC Department of Cultural',
            lastName: 'Affairs',
            email: 'pr@mail.culture.nyc.gov',
            position: 'Cultural Affairs Department',
            labels: ['government', 'cultural_affairs', 'nyc'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        }
    ],
    harmony_team: [
        {
            firstName: 'Harmony 4 All',
            lastName: 'Media',
            email: 'media@harmony4all.org',
            position: 'Media Team',
            labels: ['harmony_team', 'media', 'internal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Nahaz',
            lastName: 'Quddus',
            email: 'nahaz@harmony4all.org',
            position: 'Team Member',
            labels: ['harmony_team', 'internal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        }
    ],
    external_individuals: [
        {
            firstName: 'ahmed',
            lastName: 'Benomar',
            email: 'partitiondz@yahoo.fr',
            labels: ['individual', 'external'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        }
    ],
    recipients: [
        {
            firstName: 'Bianca',
            lastName: 'Quddus',
            email: 'biancaq@harmony4all.org',
            position: 'Team Member',
            labels: ['harmony_team', 'recipient', 'internal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Harmony 4 All',
            lastName: 'Admin',
            email: 'info@harmony4all.org',
            position: 'Administrator',
            labels: ['harmony_team', 'admin', 'internal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Joshua',
            lastName: 'Quddus',
            email: 'joshuaq@harmony4all.org',
            position: 'Team Member',
            labels: ['harmony_team', 'recipient', 'internal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Nahaz',
            lastName: 'Quddus',
            email: 'nahaz@harmony4all.org',
            position: 'Team Member',
            labels: ['harmony_team', 'recipient', 'internal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        }
    ],
    cc_recipients: [
        {
            firstName: 'Diane',
            lastName: 'Harmony',
            email: 'diane@harmony4all.org',
            position: 'Team Member',
            labels: ['harmony_team', 'cc_recipient', 'internal'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Brian',
            lastName: 'Soul Search',
            email: 'brian@soulsearchrecords.com',
            position: 'Music Producer',
            labels: ['music_industry', 'cc_recipient', 'producer'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Clarizio',
            lastName: 'Music',
            email: 'clariziomusic@gmail.com',
            position: 'Music Studio',
            labels: ['music_industry', 'cc_recipient', 'studio'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Dori',
            lastName: 'Music Studio',
            email: 'dorimusicstudio@gmail.com',
            position: 'Music Studio',
            labels: ['music_industry', 'cc_recipient', 'studio'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Eddie',
            lastName: 'Griggs',
            email: 'eddiegriggs@comcast.net',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Erica',
            lastName: 'Aldrich',
            email: 'ericaldrich@mainstreetmusicmh.com',
            position: 'Music Professional',
            labels: ['music_industry', 'cc_recipient', 'music_professional'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Fifty Two',
            lastName: 'Guitars',
            email: 'fiftytwoguitars@gmail.com',
            position: 'Music Shop',
            labels: ['music_industry', 'cc_recipient', 'retail'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Gus',
            lastName: 'Sheaman',
            email: 'gussheaman@aol.com',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'J.',
            lastName: 'Pandelios',
            email: 'jpandelios@aol.com',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Mark',
            lastName: 'D',
            email: 'markd@mockingbirdweb.com',
            position: 'Web Developer',
            labels: ['music_industry', 'cc_recipient', 'web_services'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Marlene U',
            lastName: 'Music',
            email: 'marlene.umusic@gmail.com',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Matty',
            lastName: 'Sly',
            email: 'mattysly@att.net',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'M',
            lastName: 'Conrad',
            email: 'mconrad191@gmail.com',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Michael',
            lastName: 'Snyder',
            email: 'michaelsnyder7763@gmail.com',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Mike',
            lastName: 'Music Bureau',
            email: 'mike@themusicbureau.com',
            position: 'Music Bureau',
            labels: ['music_industry', 'cc_recipient', 'music_services'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'M',
            lastName: 'Music',
            email: 'mmmusic1960@aol.com',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'M',
            lastName: 'Vacanti',
            email: 'mvacanti@aol.com',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'North Jersey',
            lastName: 'Guitar',
            email: 'northjerseyguitar@gmail.com',
            position: 'Music Shop',
            labels: ['music_industry', 'cc_recipient', 'retail'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Payettes Music',
            lastName: 'Traders',
            email: 'payettesmusictraders@gmail.com',
            position: 'Music Shop',
            labels: ['music_industry', 'cc_recipient', 'retail'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'The Garden by the',
            lastName: 'Bay',
            email: 'thegardenbythebay@gmail.com',
            position: 'Community Organization',
            labels: ['community', 'cc_recipient', 'organization'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Thomas',
            lastName: 'Tran',
            email: 'thomas.tran3219@gmail.com',
            position: 'Musician',
            labels: ['music_industry', 'cc_recipient', 'musician'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
        },
        {
            firstName: 'Woodstock Music',
            lastName: 'Shop',
            email: 'woodstockmusicshop@gmail.com',
            position: 'Music Shop',
            labels: ['music_industry', 'cc_recipient', 'retail'],
            source: 'email_list',
            emailSubscriberStatus: 'subscribed'
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
