require('dotenv').config();
const SMSService = require('../services/smsService');

async function testSMSService() {
  console.log('🚀 Testing SMS Service...\n');

  try {
    // Test data
    const testPhoneNumber = '+18883168742'; // The admin phone number
    const testMessage = `🧪 SMS Test - ${new Date().toLocaleString()} - Harmony 4 All SMS service is working correctly!`;

    console.log('📱 Sending test SMS to:', testPhoneNumber);
    console.log('💬 Message:', testMessage);
    console.log('');

    // Send test SMS
    const result = await SMSService.sendSMS(testPhoneNumber, testMessage);

    console.log('✅ SMS sent successfully!');
    console.log('📋 Message SID:', result.sid);
    console.log('📊 Status:', result.status);
    console.log('📅 Sent at:', result.dateCreated);
    console.log('');
    console.log('🎉 SMS service is working correctly!');

  } catch (error) {
    console.error('❌ SMS test failed!');
    console.error('Error:', error.message);

    if (error.message.includes('authentication')) {
      console.log('\n💡 Possible issues:');
      console.log('   - Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables');
      console.log('   - Verify your Twilio credentials are correct');
    } else if (error.message.includes('messaging service')) {
      console.log('\n💡 Possible issues:');
      console.log('   - Check TWILIO_MESSAGING_SERVICE_SID environment variable');
      console.log('   - Verify the messaging service SID is correct');
    } else if (error.message.includes('phone number')) {
      console.log('\n💡 Possible issues:');
      console.log('   - Verify the phone number format (+18883168742)');
      console.log('   - Check if the number can receive SMS');
    }

    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testSMSService()
    .then(() => {
      console.log('\n✨ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testSMSService };
