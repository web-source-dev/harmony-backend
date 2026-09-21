require('dotenv').config();
const fs = require('fs');
const path = require('path');

const SMS_MESSAGE = `Harmony 4 All: Discover how piano, bass, drums & guitar create the groove in jazz.

https://www.h4a.us/rhythm-section`;

const PHONE_LIST_PATH = path.join(__dirname, '..', 'phone-formatted.txt');
const LOGS_ROOT = path.join(__dirname, '..', 'sms-logs');
const BATCH_SIZE = Number(process.env.SMS_BATCH_SIZE || 5);
const BATCH_DELAY_MS = Number(process.env.SMS_BATCH_DELAY_MS || 3000);
const SHOULD_SEND = process.argv.includes('--send');

function loadPhoneNumbers(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Phone list not found: ${filePath}`);
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isValidUSNumber(digits) {
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) return false;
  if (/^[01]/.test(digits.slice(0, 3))) return false;
  if (/^[01]/.test(digits.slice(3, 6))) return false;
  if (digits === '1234567890' || /^(\d)\1{9}$/.test(digits)) return false;

  return true;
}

function normalizePhoneNumber(input) {
  const digits = String(input).replace(/\D/g, '');
  if (!isValidUSNumber(digits)) return null;

  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
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

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min ${seconds} sec`;
}

function estimateRuntime(totalNumbers, batchCount) {
  const apiMsPerMessage = 400;
  const sendMs = totalNumbers * apiMsPerMessage;
  const waitMs = Math.max(batchCount - 1, 0) * BATCH_DELAY_MS;
  return Math.round((sendMs + waitMs) / 1000);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getLocalDateParts(date = new Date()) {
  return {
    year: date.getFullYear(),
    month: pad2(date.getMonth() + 1),
    day: pad2(date.getDate()),
    hours: pad2(date.getHours()),
    minutes: pad2(date.getMinutes()),
    seconds: pad2(date.getSeconds()),
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function createBatchLogger(plan) {
  const startedAt = new Date();
  const parts = getLocalDateParts(startedAt);
  const dateFolder = `${parts.year}-${parts.month}-${parts.day}`;
  const runId = `${parts.hours}${parts.minutes}${parts.seconds}`;
  const runDir = path.join(LOGS_ROOT, dateFolder, `batch-${runId}`);

  fs.mkdirSync(runDir, { recursive: true });

  const paths = {
    runDir,
    runLog: path.join(runDir, 'run.log'),
    sentCsv: path.join(runDir, 'sent.csv'),
    failedCsv: path.join(runDir, 'failed.csv'),
    summaryJson: path.join(runDir, 'summary.json'),
  };

  fs.writeFileSync(
    paths.sentCsv,
    'timestamp,phone,sid,status,batch\n',
    'utf8'
  );
  fs.writeFileSync(
    paths.failedCsv,
    'timestamp,phone,error,batch\n',
    'utf8'
  );

  const writeLine = (filePath, line) => {
    fs.appendFileSync(filePath, `${line}\n`, 'utf8');
  };

  const log = (message) => {
    const stamp = new Date().toISOString();
    const line = `[${stamp}] ${message}`;
    console.log(message);
    writeLine(paths.runLog, line);
  };

  const header = [
    'Rhythm Section SMS batch run',
    `Started: ${startedAt.toISOString()}`,
    `List file: ${PHONE_LIST_PATH}`,
    `Rows in file: ${plan.rawCount}`,
    `Unique rows: ${plan.uniqueCount}`,
    `Valid numbers: ${plan.validPhoneNumbers.length}`,
    `Invalid numbers skipped: ${plan.invalidPhoneNumbers.length}`,
    `Batch size: ${BATCH_SIZE}`,
    `Wait between batches: ${BATCH_DELAY_MS}ms`,
    `Total batches: ${plan.batches.length}`,
    '',
    'Message:',
    '---',
    SMS_MESSAGE,
    '---',
    '',
  ].join('\n');

  fs.writeFileSync(paths.runLog, `${header}\n`, 'utf8');

  if (plan.invalidPhoneNumbers.length) {
    writeLine(paths.runLog, 'Invalid numbers skipped:');
    plan.invalidPhoneNumbers.forEach((phone) => {
      writeLine(paths.runLog, ` - ${phone}`);
    });
    writeLine(paths.runLog, '');
  }

  return {
    paths,
    startedAt,
    log,
    recordSent({ phone, sid, status, batchNumber }) {
      const timestamp = new Date().toISOString();
      writeLine(
        paths.sentCsv,
        [
          csvEscape(timestamp),
          csvEscape(phone),
          csvEscape(sid),
          csvEscape(status),
          csvEscape(batchNumber),
        ].join(',')
      );
      log(`SENT  ${phone} | SID: ${sid} | status: ${status} | batch ${batchNumber}`);
    },
    recordFailed({ phone, error, batchNumber }) {
      const timestamp = new Date().toISOString();
      writeLine(
        paths.failedCsv,
        [
          csvEscape(timestamp),
          csvEscape(phone),
          csvEscape(error),
          csvEscape(batchNumber),
        ].join(',')
      );
      log(`FAIL  ${phone} | Error: ${error} | batch ${batchNumber}`);
    },
    async finalize({ sent, failed }) {
      const finishedAt = new Date();
      const summary = {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt - startedAt,
        listFile: PHONE_LIST_PATH,
        batchSize: BATCH_SIZE,
        batchDelayMs: BATCH_DELAY_MS,
        planned: {
          rawCount: plan.rawCount,
          uniqueCount: plan.uniqueCount,
          validCount: plan.validPhoneNumbers.length,
          invalidCount: plan.invalidPhoneNumbers.length,
          totalBatches: plan.batches.length,
        },
        results: {
          sent: sent.length,
          failed: failed.length,
        },
        sentPhones: sent.map((item) => item.phone),
        failedPhones: failed.map((item) => ({
          phone: item.phone,
          error: item.error,
        })),
        files: {
          runLog: paths.runLog,
          sentCsv: paths.sentCsv,
          failedCsv: paths.failedCsv,
          summaryJson: paths.summaryJson,
        },
      };

      fs.writeFileSync(paths.summaryJson, JSON.stringify(summary, null, 2), 'utf8');

      log('');
      log('Batch sending complete!');
      log(`Sent: ${sent.length}`);
      log(`Failed: ${failed.length}`);
      log(`Log folder: ${paths.runDir}`);

      if (failed.length) {
        log('Failed numbers:');
        failed.forEach((item) => log(` - ${item.phone}: ${item.error}`));
      }

      try {
        log('Generating PDF report...');
        const { generateSmsBatchPdfReport } = require('./sms-batch-report');
        const report = await generateSmsBatchPdfReport(paths.runDir, { silent: true });
        paths.reportHtml = report.htmlPath;
        paths.reportPdf = report.pdfPath;
        summary.files.reportHtml = report.htmlPath;
        summary.files.reportPdf = report.pdfPath;
        fs.writeFileSync(paths.summaryJson, JSON.stringify(summary, null, 2), 'utf8');
        log(`PDF report: ${report.pdfPath}`);
      } catch (error) {
        log(`PDF report failed: ${error.message}`);
      }

      return summary;
    },
  };
}

function prepareRecipients() {
  const rawPhoneNumbers = loadPhoneNumbers(PHONE_LIST_PATH);
  const uniquePhoneNumbers = [...new Set(rawPhoneNumbers)];
  const validPhoneNumbers = [];
  const invalidPhoneNumbers = [];
  const seenNormalized = new Set();

  for (const rawPhone of uniquePhoneNumbers) {
    const normalized = normalizePhoneNumber(rawPhone);
    if (!normalized) {
      invalidPhoneNumbers.push(rawPhone);
      continue;
    }
    if (seenNormalized.has(normalized)) continue;
    seenNormalized.add(normalized);
    validPhoneNumbers.push(normalized);
  }

  return {
    rawCount: rawPhoneNumbers.length,
    uniqueCount: uniquePhoneNumbers.length,
    validPhoneNumbers,
    invalidPhoneNumbers,
    batches: chunkArray(validPhoneNumbers, BATCH_SIZE),
  };
}

function printPlan(plan) {
  const estimatedSeconds = estimateRuntime(plan.validPhoneNumbers.length, plan.batches.length);

  console.log('Rhythm Section SMS batch plan\n');
  console.log(`List file: ${PHONE_LIST_PATH}`);
  console.log(`Rows in file: ${plan.rawCount}`);
  console.log(`Unique rows: ${plan.uniqueCount}`);
  console.log(`Valid numbers: ${plan.validPhoneNumbers.length}`);
  console.log(`Invalid numbers skipped: ${plan.invalidPhoneNumbers.length}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Wait between batches: ${BATCH_DELAY_MS}ms`);
  console.log(`Total batches: ${plan.batches.length}`);
  console.log(`Estimated runtime: ${formatDuration(estimatedSeconds)}`);
  console.log('\nMessage:');
  console.log('---');
  console.log(SMS_MESSAGE);
  console.log('---');
  console.log('\nFirst 5 numbers:');
  plan.validPhoneNumbers.slice(0, 5).forEach((phone) => console.log(` - ${phone}`));

  if (plan.invalidPhoneNumbers.length) {
    console.log('\nInvalid numbers skipped:');
    plan.invalidPhoneNumbers.forEach((phone) => console.log(` - ${phone}`));
  }
}

async function sendBatchSMS() {
  const plan = prepareRecipients();
  printPlan(plan);

  if (!SHOULD_SEND) {
    console.log('\nPreview only. Nothing was sent.');
    console.log('After client confirmation, run:');
    console.log('  npm run send-batch-sms -- --send');
    return;
  }

  const logger = createBatchLogger(plan);
  const SMSService = require('../services/smsService');
  const sent = [];
  const failed = [];

  logger.log('Sending started. This will send live SMS messages.');
  logger.log(`Log folder: ${logger.paths.runDir}`);

  for (let i = 0; i < plan.batches.length; i += 1) {
    const batch = plan.batches[i];
    const batchNumber = i + 1;

    logger.log(`Sending batch ${batchNumber}/${plan.batches.length}...`);

    for (const phone of batch) {
      try {
        const result = await SMSService.sendSMS(phone, SMS_MESSAGE);
        const entry = { phone, sid: result.sid, status: result.status };
        sent.push(entry);
        logger.recordSent({
          phone,
          sid: result.sid,
          status: result.status,
          batchNumber,
        });
      } catch (error) {
        const entry = { phone, error: error.message };
        failed.push(entry);
        logger.recordFailed({
          phone,
          error: error.message,
          batchNumber,
        });
      }
    }

    if (batchNumber < plan.batches.length) {
      logger.log(`Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  await logger.finalize({ sent, failed });
}

if (require.main === module) {
  sendBatchSMS()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\nBatch SMS script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { sendBatchSMS };
