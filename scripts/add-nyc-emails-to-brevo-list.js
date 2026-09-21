require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.BREVO_API_KEY;
const LIST_ID = Number(process.env.BREVO_NYC_LIST_ID || 5);
const BATCH_SIZE = 150;

if (!API_KEY) {
    console.error("❌ BREVO_API_KEY is missing in .env");
    process.exit(1);
}

const API = "https://api.brevo.com/v3";

const headers = {
    "api-key": API_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEmails() {
    const txtPath = path.join(__dirname, "..", "brevo-nyc-emails", "nyc-emails.txt");

    if (!fs.existsSync(txtPath)) {
        console.error(`❌ Missing file: ${txtPath}`);
        process.exit(1);
    }

    const emails = fs
        .readFileSync(txtPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    return [...new Set(emails)];
}

async function getList(listId) {
    const response = await axios.get(`${API}/contacts/lists/${listId}`, {
        headers,
    });
    return response.data;
}

async function addEmailsToList(listId, emails) {
    const response = await axios.post(
        `${API}/contacts/lists/${listId}/contacts/add`,
        { emails },
        { headers }
    );
    return response.data;
}

async function main() {
    console.log("========================================");
    console.log("   ADD NYC EMAILS TO BREVO LIST");
    console.log("========================================\n");

    const emails = loadEmails();
    console.log(`Emails to add: ${emails.length}`);
    console.log(`Target list ID: ${LIST_ID}\n`);

    let list;
    try {
        list = await getList(LIST_ID);
    } catch (error) {
        console.error(
            "❌ Could not load Brevo list:",
            error.response?.data || error.message
        );
        process.exit(1);
    }

    console.log(`List name: ${list.name}`);
    console.log(`Folder ID: ${list.folderId}`);
    console.log(`Current unique subscribers: ${list.uniqueSubscribers ?? 0}`);
    console.log(`Total blacklisted: ${list.totalBlacklisted ?? 0}\n`);

    const successes = [];
    const failures = [];
    let batchesOk = 0;
    let batchesFailed = 0;

    const totalBatches = Math.ceil(emails.length / BATCH_SIZE);

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        console.log(
            `📤 Batch ${batchNumber}/${totalBatches}: adding ${batch.length} emails...`
        );

        try {
            const result = await addEmailsToList(LIST_ID, batch);
            const success = result?.contacts?.success || [];
            const failure = result?.contacts?.failure || [];

            successes.push(...success);
            failures.push(...failure);
            batchesOk += 1;

            console.log(
                `   Success: ${success.length}  Failure: ${failure.length}`
            );
        } catch (error) {
            batchesFailed += 1;
            console.error(
                `   ❌ Batch failed:`,
                error.response?.data || error.message
            );
            failures.push(...batch);
        }

        await sleep(400);
    }

    const outputDir = path.join(__dirname, "..", "brevo-nyc-emails");
    const summaryPath = path.join(outputDir, "add-to-list-summary.json");
    const failurePath = path.join(outputDir, "add-to-list-failures.txt");

    const summary = {
        addedAt: new Date().toISOString(),
        listId: LIST_ID,
        listName: list.name,
        emailsAttempted: emails.length,
        batchesOk,
        batchesFailed,
        successCount: successes.length,
        failureCount: failures.length,
        failures,
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
    fs.writeFileSync(failurePath, failures.join("\n") + (failures.length ? "\n" : ""), "utf8");

    console.log("\n========================================");
    console.log("   RESULTS");
    console.log("========================================");
    console.log(`Attempted: ${emails.length}`);
    console.log(`Added: ${successes.length}`);
    console.log(`Failed: ${failures.length}`);
    console.log(`Wrote: ${path.relative(process.cwd(), summaryPath)}`);
    if (failures.length) {
        console.log(`Wrote: ${path.relative(process.cwd(), failurePath)}`);
    }
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
});
