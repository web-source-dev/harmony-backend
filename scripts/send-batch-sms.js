require('dotenv').config();
const SMSService = require('../services/smsService');

const SMS_MESSAGE = `Hi! This is Harmony 4 All 🎶

Thank you for signing up at the Youth Action Resource Fair! Please complete your registration here:

👉 https://www.h4a.us/registration-application

After registering, please email us at info@harmony4all.org to confirm.

Questions? Call/text us at (737) 427-6669. Reply STOP to opt out`;

const RAW_PHONE_NUMBERS = [
  '9174950388',
  '4078819005',
  '3478197850',
  '5164011505',
  '9292454870',
  '7184905405',
  '9293507227',
  '9089921497',
  '6465418050',
  '3479419061',
  '9292307629',
  '6465801235',
  '3473623348',
  '3473675452',
  '9175889501',
  '9177577877',
  '3474591829',
  '9293703342',
  '3472007309',
  '9176154971',
  '7187902600',
  '2012688768',
  '8609445727',
  '6464240539',
  '3479610397',
  '9296058628',
  '3479880253',
  '3474572428',
  '9296782724',
  '3475647845',
  '3474358504',
  '3478312582',
  '3475935492',
  '9296966206',
  '9294200052',
  '9295427845',
  '5163097543',
  '3478847958',
  '2532398190',
  '3478168386',
  '9293871426',
  '264817385540',
  '3479315153',
  '(917)681-9891',
  '(737)427-6669'
];

const BATCH_SIZE = Number(process.env.SMS_BATCH_SIZE || 5);
const BATCH_DELAY_MS = Number(process.env.SMS_BATCH_DELAY_MS || 3000);

function normalizePhoneNumber(input) {
  const digits = String(input).replace(/\D/g, '');

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;

  return null;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendBatchSMS() {
  console.log('🚀 Starting batch SMS sending...\n');

  const uniquePhoneNumbers = [...new Set(RAW_PHONE_NUMBERS)];
  const validPhoneNumbers = [];
  const invalidPhoneNumbers = [];

  for (const rawPhone of uniquePhoneNumbers) {
    const normalized = normalizePhoneNumber(rawPhone);
    if (normalized) {
      validPhoneNumbers.push(normalized);
    } else {
      invalidPhoneNumbers.push(rawPhone);
    }
  }

  const batches = chunkArray(validPhoneNumbers, BATCH_SIZE);
  const sent = [];
  const failed = [];

  console.log(`📋 Total unique numbers: ${uniquePhoneNumbers.length}`);
  console.log(`✅ Valid numbers: ${validPhoneNumbers.length}`);
  console.log(`❌ Invalid numbers: ${invalidPhoneNumbers.length}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`🔢 Total batches: ${batches.length}\n`);

  if (invalidPhoneNumbers.length) {
    console.log('Invalid numbers skipped:');
    invalidPhoneNumbers.forEach((phone) => console.log(` - ${phone}`));
    console.log('');
  }

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const batchNumber = i + 1;

    console.log(`\n📤 Sending batch ${batchNumber}/${batches.length}...`);

    for (const phone of batch) {
      try {
        const result = await SMSService.sendSMS(phone, SMS_MESSAGE);
        sent.push({ phone, sid: result.sid, status: result.status });
        console.log(`✅ Sent to ${phone} | SID: ${result.sid}`);
      } catch (error) {
        failed.push({ phone, error: error.message });
        console.log(`❌ Failed to ${phone} | Error: ${error.message}`);
      }
    }

    if (batchNumber < batches.length) {
      console.log(`⏳ Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log('\n🎉 Batch sending complete!');
  console.log(`✅ Sent: ${sent.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length) {
    console.log('\nFailed numbers:');
    failed.forEach((item) => console.log(` - ${item.phone}: ${item.error}`));
  }
}

if (require.main === module) {
  sendBatchSMS()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n💥 Batch SMS script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { sendBatchSMS };
