require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.BREVO_API_KEY;
const LIST_ID = Number(process.env.BREVO_NYC_LIST_ID || 5);
const BATCH_SIZE = 150;
const KEEP_DOMAIN = "schools.nyc.gov";

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

function isSchoolsNycGov(email) {
    const lower = String(email || "").trim().toLowerCase();
    return lower.endsWith(`@${KEEP_DOMAIN}`);
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

async function removeEmailsFromList(listId, emails) {
    const response = await axios.post(
        `${API}/contacts/lists/${listId}/contacts/remove`,
        { emails },
        { headers }
    );
    return response.data;
}

async function main() {
    console.log("========================================");
    console.log("   KEEP ONLY SCHOOLS.NYC.GOV ON LIST");
    console.log("========================================\n");

    const emails = loadEmails();
    const keep = emails.filter(isSchoolsNycGov);
    const remove = emails.filter((email) => !isSchoolsNycGov(email));

    console.log(`Loaded NYC emails: ${emails.length}`);
    console.log(`Keep (@${KEEP_DOMAIN}): ${keep.length}`);
    console.log(`Remove from list: ${remove.length}`);
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
    console.log(`Current unique subscribers: ${list.uniqueSubscribers ?? 0}\n`);

    if (remove.length === 0) {
        console.log("Nothing to remove.");
        return;
    }

    const successes = [];
    const failures = [];
    let batchesOk = 0;
    let batchesFailed = 0;
    const totalBatches = Math.ceil(remove.length / BATCH_SIZE);

    for (let i = 0; i < remove.length; i += BATCH_SIZE) {
        const batch = remove.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        console.log(
            `📤 Batch ${batchNumber}/${totalBatches}: removing ${batch.length} emails...`
        );

        try {
            const result = await removeEmailsFromList(LIST_ID, batch);
            const success = result?.contacts?.success || result?.success || [];
            const failure = result?.contacts?.failure || result?.failure || [];

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

    let listAfter = null;
    try {
        listAfter = await getList(LIST_ID);
    } catch (error) {
        console.error(
            "⚠️ Could not reload list after update:",
            error.response?.data || error.message
        );
    }

    const outputDir = path.join(__dirname, "..", "brevo-nyc-emails");
    const summaryPath = path.join(outputDir, "remove-non-school-summary.json");
    const removedPath = path.join(outputDir, "removed-from-list.txt");
    const keptPath = path.join(outputDir, "schools-nyc-gov-emails.txt");
    const failurePath = path.join(outputDir, "remove-from-list-failures.txt");

    fs.writeFileSync(
        summaryPath,
        JSON.stringify(
            {
                updatedAt: new Date().toISOString(),
                listId: LIST_ID,
                listName: list.name,
                keepDomain: KEEP_DOMAIN,
                emailsOnListBefore: list.uniqueSubscribers ?? 0,
                emailsOnListAfter: listAfter?.uniqueSubscribers ?? null,
                keepCount: keep.length,
                removeAttempted: remove.length,
                removeSuccessCount: successes.length,
                removeFailureCount: failures.length,
                batchesOk,
                batchesFailed,
                failures,
            },
            null,
            2
        ),
        "utf8"
    );
    fs.writeFileSync(removedPath, remove.join("\n") + "\n", "utf8");
    fs.writeFileSync(keptPath, keep.join("\n") + "\n", "utf8");
    fs.writeFileSync(
        failurePath,
        failures.join("\n") + (failures.length ? "\n" : ""),
        "utf8"
    );

    console.log("\n========================================");
    console.log("   RESULTS");
    console.log("========================================");
    console.log(`Removed: ${successes.length}`);
    console.log(`Failed: ${failures.length}`);
    if (listAfter) {
        console.log(`List unique subscribers now: ${listAfter.uniqueSubscribers}`);
        console.log(`List total subscribers now: ${listAfter.totalSubscribers}`);
        console.log(`List blacklisted now: ${listAfter.totalBlacklisted}`);
    }
    console.log(`Wrote: ${path.relative(process.cwd(), summaryPath)}`);
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
});
