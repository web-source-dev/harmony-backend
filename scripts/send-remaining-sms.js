require("dotenv").config();

const fs = require("fs");
const path = require("path");

const SMS_MESSAGE = `Harmony 4 All: Discover how piano, bass, drums & guitar create the groove in jazz.

https://www.h4a.us/rhythm-section

Reply STOP to opt out`;

const PHONE_LIST_PATH = path.join(__dirname, "..", "phone-formatted.txt");
const OUTPUT_DIR = path.join(__dirname, "..", "sms-resume");
const REMAINING_PATH = path.join(OUTPUT_DIR, "remaining-to-send.txt");
const SENT_LOG_PATH = path.join(OUTPUT_DIR, "sent-log.csv");
const FAILED_LOG_PATH = path.join(OUTPUT_DIR, "failed-log.csv");

const BATCH_SIZE = Number(process.env.SMS_BATCH_SIZE || 5);
const BATCH_DELAY_MS = Number(process.env.SMS_BATCH_DELAY_MS || 3000);
const AUTH_RETRY_DELAY_MS = Number(process.env.SMS_AUTH_RETRY_DELAY_MS || 10000);
const SHOULD_SEND = process.argv.includes("--send");

const ORIGINAL_BATCH_SIZE = 5;
const FUNDS_FAILED_FROM_BATCH = 602;
const FUNDS_FAILED_THROUGH_BATCH = 646;
const STOPPED_AFTER_BATCH = 660;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidUSNumber(digits) {
    if (digits.length === 11 && digits.startsWith("1")) {
        digits = digits.slice(1);
    }

    if (digits.length !== 10) return false;
    if (/^[01]/.test(digits.slice(0, 3))) return false;
    if (/^[01]/.test(digits.slice(3, 6))) return false;
    if (digits === "1234567890" || /^(\d)\1{9}$/.test(digits)) return false;

    return true;
}

function normalizePhoneNumber(input) {
    const digits = String(input).replace(/\D/g, "");
    if (!isValidUSNumber(digits)) return null;
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`;
}

function loadValidPhones(filePath) {
    const raw = fs
        .readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const valid = [];
    const seen = new Set();

    for (const row of raw) {
        const normalized = normalizePhoneNumber(row);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        valid.push(normalized);
    }

    return valid;
}

function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
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

function csvEscape(value) {
    const stringValue = String(value ?? "");
    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function buildResumeList(allValid) {
    const from = (FUNDS_FAILED_FROM_BATCH - 1) * ORIGINAL_BATCH_SIZE;
    const through = FUNDS_FAILED_THROUGH_BATCH * ORIGINAL_BATCH_SIZE;
    const fundsFailed = allValid.slice(from, through);

    const batch647 = allValid.slice(through, through + ORIGINAL_BATCH_SIZE);
    const batch647Unsent = batch647.filter(
        (phone) => phone !== "+18754554923" && phone !== "+19177472582" && phone !== "+19175614913"
    );

    const remainingAfterStop = allValid.slice(
        STOPPED_AFTER_BATCH * ORIGINAL_BATCH_SIZE
    );

    const seen = new Set();
    const resume = [];
    for (const phone of [...fundsFailed, ...batch647Unsent, ...remainingAfterStop]) {
        if (seen.has(phone)) continue;
        seen.add(phone);
        resume.push(phone);
    }

    return {
        fundsFailed,
        batch647Unsent,
        remainingAfterStop,
        resume,
    };
}

function isAuthError(error) {
    const message = String(error && error.message ? error.message : error);
    return /authenticate/i.test(message);
}

async function sendWithAuthRetry(smsService, phone) {
    try {
        return await smsService.sendSMS(phone, SMS_MESSAGE);
    } catch (error) {
        if (!isAuthError(error)) {
            throw error;
        }

        console.log(
            `Authenticate on ${phone}. Waiting ${AUTH_RETRY_DELAY_MS}ms and retrying once...`
        );
        await sleep(AUTH_RETRY_DELAY_MS);
        return smsService.sendSMS(phone, SMS_MESSAGE);
    }
}

async function main() {
    const allValid = loadValidPhones(PHONE_LIST_PATH);
    const { fundsFailed, batch647Unsent, remainingAfterStop, resume } =
        buildResumeList(allValid);
    const batches = chunkArray(resume, BATCH_SIZE);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(REMAINING_PATH, resume.join("\n") + "\n", "utf8");

    console.log("Rhythm Section SMS resume plan\n");
    console.log(`Original valid numbers: ${allValid.length}`);
    console.log(
        `Funds failed batches ${FUNDS_FAILED_FROM_BATCH}-${FUNDS_FAILED_THROUGH_BATCH}: ${fundsFailed.length}`
    );
    console.log(`Unsent from batch 647: ${batch647Unsent.length}`);
    console.log(
        `Never sent after batch ${STOPPED_AFTER_BATCH}: ${remainingAfterStop.length}`
    );
    console.log(`Total to send now: ${resume.length}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Wait between batches: ${BATCH_DELAY_MS}ms`);
    console.log(`Total batches: ${batches.length}`);
    console.log(
        `Estimated runtime: ${formatDuration(estimateRuntime(resume.length, batches.length))}`
    );
    console.log(`Wrote: ${path.relative(process.cwd(), REMAINING_PATH)}`);
    console.log("\nMessage:");
    console.log("---");
    console.log(SMS_MESSAGE);
    console.log("---");
    console.log("\nFirst 5 numbers:");
    resume.slice(0, 5).forEach((phone) => console.log(` - ${phone}`));
    console.log("Last 5 numbers:");
    resume.slice(-5).forEach((phone) => console.log(` - ${phone}`));

    if (!SHOULD_SEND) {
        console.log("\nPreview only. Nothing was sent.");
        console.log("After confirming Twilio has funds, run:");
        console.log("  npm run send-resume-sms -- --send");
        return;
    }

    const SMSService = require("../services/smsService");
    const sent = [];
    const failed = [];

    fs.writeFileSync(SENT_LOG_PATH, "phone,sid,status\n", "utf8");
    fs.writeFileSync(FAILED_LOG_PATH, "phone,error\n", "utf8");

    console.log("\nSending started. This will send live SMS messages.\n");

    for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];
        const batchNumber = i + 1;

        console.log(`\nSending resume batch ${batchNumber}/${batches.length}...`);

        for (const phone of batch) {
            try {
                const result = await sendWithAuthRetry(SMSService, phone);
                sent.push({ phone, sid: result.sid, status: result.status });
                fs.appendFileSync(
                    SENT_LOG_PATH,
                    `${csvEscape(phone)},${csvEscape(result.sid)},${csvEscape(result.status)}\n`,
                    "utf8"
                );
                console.log(`Sent to ${phone} | SID: ${result.sid}`);
            } catch (error) {
                failed.push({ phone, error: error.message });
                fs.appendFileSync(
                    FAILED_LOG_PATH,
                    `${csvEscape(phone)},${csvEscape(error.message)}\n`,
                    "utf8"
                );
                console.log(`Failed to ${phone} | Error: ${error.message}`);

                if (isAuthError(error)) {
                    const leftover = [phone, ...resume.slice(sent.length + failed.length)];
                    const leftoverPath = path.join(OUTPUT_DIR, "stopped-leftover.txt");
                    fs.writeFileSync(leftoverPath, leftover.join("\n") + "\n", "utf8");
                    console.error(
                        "\nAuthenticate failed again. Stopping so we do not burn the rest of the list."
                    );
                    console.error(
                        `Add Twilio funds, then send leftover file: ${path.relative(process.cwd(), leftoverPath)}`
                    );
                    console.error(`Sent this run: ${sent.length}`);
                    console.error(`Failed this run: ${failed.length}`);
                    process.exit(1);
                }
            }
        }

        if (batchNumber < batches.length) {
            console.log(`Waiting ${BATCH_DELAY_MS}ms before next batch...`);
            await sleep(BATCH_DELAY_MS);
        }
    }

    console.log("\nResume sending complete!");
    console.log(`Sent: ${sent.length}`);
    console.log(`Failed: ${failed.length}`);
    if (failed.length) {
        console.log("\nFailed numbers:");
        failed.forEach((item) => console.log(` - ${item.phone}: ${item.error}`));
    }
}

main().catch((error) => {
    console.error("\nResume SMS script failed:", error.message);
    process.exit(1);
});
