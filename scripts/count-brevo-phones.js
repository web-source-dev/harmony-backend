require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.BREVO_API_KEY;

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

const PHONE_ATTRIBUTE_KEYS = [
    "SMS",
    "PHONE",
    "PHONE_NUMBER",
    "WHATSAPP",
    "LANDLINE_NUMBER",
    "MOBILE",
    "CELL",
    "CELL_PHONE",
    "TELEPHONE",
    "TEL",
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function csvEscape(value) {
    if (value === null || value === undefined) {
        return "";
    }

    const stringValue = String(value);

    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

function isNonEmpty(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
}

function looksLikePhone(value) {
    if (!isNonEmpty(value)) {
        return false;
    }

    const digits = String(value).replace(/\D/g, "");
    return digits.length >= 7;
}

function getPhoneFromContact(contact) {
    const attrs = contact.attributes || {};
    const found = [];

    for (const key of PHONE_ATTRIBUTE_KEYS) {
        if (looksLikePhone(attrs[key])) {
            found.push({ key, value: String(attrs[key]).trim() });
        }
    }

    for (const [key, value] of Object.entries(attrs)) {
        const upper = key.toUpperCase();
        if (PHONE_ATTRIBUTE_KEYS.includes(upper)) {
            continue;
        }

        if (
            /(PHONE|SMS|MOBILE|CELL|WHATSAPP|TELEPHONE|TEL)/i.test(key) &&
            looksLikePhone(value)
        ) {
            found.push({ key, value: String(value).trim() });
        }
    }

    return found;
}

async function fetchAllContacts() {
    const contacts = [];
    let offset = 0;
    const limit = 500;
    let reportedCount = null;

    while (true) {
        console.log(`📥 Fetching contacts ${offset + 1} – ${offset + limit}...`);

        try {
            const response = await axios.get(`${API}/contacts`, {
                headers,
                params: {
                    limit,
                    offset,
                    sort: "asc",
                },
            });

            const batch = response.data.contacts || [];
            reportedCount = response.data.count ?? reportedCount;

            contacts.push(...batch);

            console.log(
                `   Received ${batch.length}` +
                    (reportedCount != null ? ` (Brevo count: ${reportedCount})` : "")
            );

            if (batch.length < limit) {
                break;
            }

            offset += limit;
            await sleep(300);
        } catch (error) {
            console.error(
                "❌ Failed to fetch contacts:",
                error.response?.data || error.message
            );
            process.exit(1);
        }
    }

    return { contacts, reportedCount };
}

async function main() {
    console.log("========================================");
    console.log("   BREVO CONTACTS WITH PHONE NUMBERS");
    console.log("========================================\n");

    const { contacts, reportedCount } = await fetchAllContacts();

    const withPhone = [];
    const withoutPhone = [];

    for (const contact of contacts) {
        const phones = getPhoneFromContact(contact);

        if (phones.length > 0) {
            withPhone.push({ contact, phones });
        } else {
            withoutPhone.push(contact);
        }
    }

    const total = contacts.length;
    const withPhoneCount = withPhone.length;
    const withoutPhoneCount = withoutPhone.length;
    const percent =
        total === 0 ? 0 : ((withPhoneCount / total) * 100).toFixed(1);

    console.log("\n========================================");
    console.log("   RESULTS");
    console.log("========================================");
    if (reportedCount != null) {
        console.log(`Brevo reported count: ${reportedCount}`);
    }
    console.log(`Total contacts fetched: ${total}`);
    console.log(`Contacts WITH a phone number: ${withPhoneCount} (${percent}%)`);
    console.log(`Contacts WITHOUT a phone number: ${withoutPhoneCount}`);
    console.log("========================================\n");

    const outputDir = path.join(__dirname, "..", "brevo-phone-report");
    fs.mkdirSync(outputDir, { recursive: true });

    const csvLines = [
        ["email", "id", "firstName", "lastName", "phoneAttribute", "phone"].join(
            ","
        ),
    ];

    for (const { contact, phones } of withPhone) {
        const attrs = contact.attributes || {};
        csvLines.push(
            [
                csvEscape(contact.email || ""),
                csvEscape(contact.id || ""),
                csvEscape(attrs.FIRSTNAME || ""),
                csvEscape(attrs.LASTNAME || ""),
                csvEscape(phones.map((p) => p.key).join("|")),
                csvEscape(phones.map((p) => p.value).join("|")),
            ].join(",")
        );
    }

    const csvPath = path.join(outputDir, "contacts-with-phone.csv");
    const summaryPath = path.join(outputDir, "summary.json");

    fs.writeFileSync(csvPath, csvLines.join("\n"), "utf8");
    fs.writeFileSync(
        summaryPath,
        JSON.stringify(
            {
                fetchedAt: new Date().toISOString(),
                brevoReportedCount: reportedCount,
                totalContacts: total,
                contactsWithPhone: withPhoneCount,
                contactsWithoutPhone: withoutPhoneCount,
                percentWithPhone: Number(percent),
            },
            null,
            2
        ),
        "utf8"
    );

    console.log(`Wrote: ${path.relative(process.cwd(), csvPath)}`);
    console.log(`Wrote: ${path.relative(process.cwd(), summaryPath)}`);
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
});
