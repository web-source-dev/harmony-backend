require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.BREVO_API_KEY;
const LIST_ID = 4;
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

function formatDashedPhone(raw) {
    let digits = String(raw).replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
        digits = digits.slice(1);
    }
    if (digits.length !== 10) {
        return null;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

async function getList(listId) {
    const response = await axios.get(`${API}/contacts/lists/${listId}`, {
        headers,
    });
    return response.data;
}

async function addToList(listId, body) {
    const response = await axios.post(
        `${API}/contacts/lists/${listId}/contacts/add`,
        body,
        { headers }
    );
    return response.data;
}

function collectSuccessFailure(result) {
    return {
        success: result?.contacts?.success || result?.success || [],
        failure: result?.contacts?.failure || result?.failure || [],
    };
}

async function main() {
    const contactsPath = path.join(__dirname, "..", "brevo-nahaz-cell", "contacts.json");
    const summaryPath = path.join(
        __dirname,
        "..",
        "brevo-nahaz-cell",
        "import-summary.json"
    );
    const phoneListPath = path.join(__dirname, "..", "phone-formatted.txt");

    const people = JSON.parse(fs.readFileSync(contactsPath, "utf8"));
    const importSummary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));

    const emails = [
        ...new Set(
            people
                .map((person) => (person.emails || [])[0])
                .filter(Boolean)
                .map((email) => String(email).trim().toLowerCase())
        ),
    ];

    const smsOnlyIds = importSummary.results
        .filter((row) => !row.email && row.id)
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id) && id > 0);

    const phonesToAdd = [];
    const seenPhones = new Set();
    for (const person of people) {
        for (const phone of person.phones || []) {
            const formatted = formatDashedPhone(phone);
            if (!formatted || seenPhones.has(formatted)) {
                continue;
            }
            seenPhones.add(formatted);
            phonesToAdd.push(formatted);
        }
    }

    console.log("========================================");
    console.log("   ADD NAHAZ CONTACTS TO LIST #4 + SMS");
    console.log("========================================\n");
    console.log(`Primary emails: ${emails.length}`);
    console.log(`SMS-only IDs: ${smsOnlyIds.length}`);
    console.log(`Unique phones: ${phonesToAdd.length}\n`);

    const listBefore = await getList(LIST_ID);
    console.log(`List #${LIST_ID}: ${listBefore.name}`);
    console.log(`Unique subscribers before: ${listBefore.uniqueSubscribers}\n`);

    const successes = [];
    const failures = [];

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);
        console.log(`📤 Adding ${batch.length} emails to list ${LIST_ID}...`);
        try {
            const { success, failure } = collectSuccessFailure(
                await addToList(LIST_ID, { emails: batch })
            );
            successes.push(...success);
            failures.push(...failure);
            console.log(`   Success: ${success.length}  Failure: ${failure.length}`);
        } catch (error) {
            console.error("   ❌ Email batch failed:", error.response?.data || error.message);
            failures.push(...batch);
        }
        await sleep(300);
    }

    if (smsOnlyIds.length) {
        console.log(`📤 Adding ${smsOnlyIds.length} SMS-only contacts by ID...`);
        try {
            const { success, failure } = collectSuccessFailure(
                await addToList(LIST_ID, { ids: smsOnlyIds })
            );
            successes.push(...success);
            failures.push(...failure);
            console.log(`   Success: ${success.length}  Failure: ${failure.length}`);
        } catch (error) {
            console.error("   ❌ ID batch failed:", error.response?.data || error.message);
            failures.push(...smsOnlyIds);
        }
    }

    const existingPhoneLines = fs
        .readFileSync(phoneListPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const existingDigits = new Set(
        existingPhoneLines.map((line) => line.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""))
    );

    const newPhoneLines = phonesToAdd.filter((phone) => {
        const digits = phone.replace(/\D/g, "");
        return !existingDigits.has(digits);
    });
    const alreadyInSmsList = phonesToAdd.length - newPhoneLines.length;

    if (newPhoneLines.length) {
        const needsNewline = !fs.readFileSync(phoneListPath, "utf8").endsWith("\n");
        fs.appendFileSync(
            phoneListPath,
            `${needsNewline ? "\n" : ""}${newPhoneLines.join("\n")}\n`,
            "utf8"
        );
    }

    const listAfter = await getList(LIST_ID);
    const outPath = path.join(
        __dirname,
        "..",
        "brevo-nahaz-cell",
        "add-to-list-4-summary.json"
    );

    fs.writeFileSync(
        outPath,
        JSON.stringify(
            {
                updatedAt: new Date().toISOString(),
                listId: LIST_ID,
                listName: listAfter.name,
                uniqueBefore: listBefore.uniqueSubscribers,
                uniqueAfter: listAfter.uniqueSubscribers,
                emailsAttempted: emails.length,
                smsOnlyIdsAttempted: smsOnlyIds.length,
                addSuccessCount: successes.length,
                addFailureCount: failures.length,
                failures,
                smsFile: {
                    phonesOnNahazContacts: phonesToAdd.length,
                    alreadyInPhoneFormatted: alreadyInSmsList,
                    appendedToPhoneFormatted: newPhoneLines.length,
                    appended: newPhoneLines,
                },
            },
            null,
            2
        ),
        "utf8"
    );

    console.log("\n========================================");
    console.log("   RESULTS");
    console.log("========================================");
    console.log(`List #4 unique subscribers now: ${listAfter.uniqueSubscribers}`);
    console.log(`Added to list #4: ${successes.length}`);
    console.log(`Already on list / failed: ${failures.length}`);
    console.log(`Phones already in phone-formatted.txt: ${alreadyInSmsList}`);
    console.log(`Phones appended to phone-formatted.txt: ${newPhoneLines.length}`);
    console.log(`Wrote: ${path.relative(process.cwd(), outPath)}`);
}

main().catch((error) => {
    console.error("❌ Script failed:", error.response?.data || error);
    process.exit(1);
});
