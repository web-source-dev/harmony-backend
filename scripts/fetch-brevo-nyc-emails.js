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

function getEmailMatchReason(email) {
    if (!email) {
        return null;
    }

    const lower = String(email).toLowerCase();

    if (lower.includes("schools.nyc.gov")) {
        return "schools.nyc.gov";
    }
    if (lower.includes("council.nyc.gov")) {
        return "council.nyc.gov";
    }
    if (lower.includes("nyc.gov")) {
        return "nyc.gov";
    }
    if (lower.includes(".nyc")) {
        return ".nyc domain";
    }
    if (lower.includes("newyork")) {
        return "newyork";
    }
    if (lower.includes("new-york")) {
        return "new-york";
    }
    if (lower.includes("new_york")) {
        return "new_york";
    }
    if (/\bnyc\b/.test(lower) || lower.includes("nyc")) {
        return "nyc";
    }

    return null;
}

function isNycEmail(email) {
    if (!email) {
        return false;
    }

    const lower = String(email).toLowerCase();
    return (
        lower.includes("nyc") ||
        lower.includes("newyork") ||
        lower.includes("new-york") ||
        lower.includes("new_york")
    );
}

function getDomain(email) {
    if (!email || !email.includes("@")) {
        return "";
    }

    return email.split("@").pop().toLowerCase();
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
    console.log("   BREVO NYC / NEW YORK EMAILS");
    console.log("========================================\n");

    const { contacts, reportedCount } = await fetchAllContacts();

    const nycContacts = [];
    const seenEmails = new Set();

    for (const contact of contacts) {
        const email = (contact.email || "").trim();

        if (!isNycEmail(email)) {
            continue;
        }

        const key = email.toLowerCase();
        if (seenEmails.has(key)) {
            continue;
        }
        seenEmails.add(key);

        const attrs = contact.attributes || {};
        nycContacts.push({
            email,
            id: contact.id || "",
            firstName: attrs.FIRSTNAME || "",
            lastName: attrs.LASTNAME || "",
            domain: getDomain(email),
            matchReason: getEmailMatchReason(email),
            listIds: Array.isArray(contact.listIds)
                ? contact.listIds.join("|")
                : "",
            emailBlacklisted: Boolean(contact.emailBlacklisted),
            smsBlacklisted: Boolean(contact.smsBlacklisted),
            createdAt: contact.createdAt || "",
            modifiedAt: contact.modifiedAt || "",
        });
    }

    nycContacts.sort((a, b) => a.email.localeCompare(b.email));

    const domainCounts = {};
    const reasonCounts = {};

    for (const row of nycContacts) {
        domainCounts[row.domain] = (domainCounts[row.domain] || 0) + 1;
        reasonCounts[row.matchReason] =
            (reasonCounts[row.matchReason] || 0) + 1;
    }

    const total = contacts.length;
    const nycCount = nycContacts.length;
    const percent = total === 0 ? 0 : ((nycCount / total) * 100).toFixed(1);

    console.log("\n========================================");
    console.log("   RESULTS");
    console.log("========================================");
    if (reportedCount != null) {
        console.log(`Brevo reported count: ${reportedCount}`);
    }
    console.log(`Total contacts fetched: ${total}`);
    console.log(`NYC / New York emails: ${nycCount} (${percent}%)`);
    console.log("\nBy match:");
    for (const [reason, count] of Object.entries(reasonCounts).sort(
        (a, b) => b[1] - a[1]
    )) {
        console.log(`  ${reason}: ${count}`);
    }
    console.log("\nTop domains:");
    Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([domain, count]) => {
            console.log(`  ${domain}: ${count}`);
        });
    console.log("========================================\n");

    const outputDir = path.join(__dirname, "..", "brevo-nyc-emails");
    fs.mkdirSync(outputDir, { recursive: true });

    const csvLines = [
        [
            "email",
            "id",
            "firstName",
            "lastName",
            "domain",
            "matchReason",
            "listIds",
            "emailBlacklisted",
            "createdAt",
            "modifiedAt",
        ].join(","),
    ];

    for (const row of nycContacts) {
        csvLines.push(
            [
                csvEscape(row.email),
                csvEscape(row.id),
                csvEscape(row.firstName),
                csvEscape(row.lastName),
                csvEscape(row.domain),
                csvEscape(row.matchReason),
                csvEscape(row.listIds),
                csvEscape(row.emailBlacklisted),
                csvEscape(row.createdAt),
                csvEscape(row.modifiedAt),
            ].join(",")
        );
    }

    const csvPath = path.join(outputDir, "nyc-emails.csv");
    const txtPath = path.join(outputDir, "nyc-emails.txt");
    const summaryPath = path.join(outputDir, "summary.json");

    fs.writeFileSync(csvPath, csvLines.join("\n"), "utf8");
    fs.writeFileSync(
        txtPath,
        nycContacts.map((row) => row.email).join("\n") + "\n",
        "utf8"
    );
    fs.writeFileSync(
        summaryPath,
        JSON.stringify(
            {
                fetchedAt: new Date().toISOString(),
                brevoReportedCount: reportedCount,
                totalContacts: total,
                nycEmailCount: nycCount,
                percentNyc: Number(percent),
                matchReasons: reasonCounts,
                domains: domainCounts,
            },
            null,
            2
        ),
        "utf8"
    );

    console.log(`Wrote: ${path.relative(process.cwd(), csvPath)}`);
    console.log(`Wrote: ${path.relative(process.cwd(), txtPath)}`);
    console.log(`Wrote: ${path.relative(process.cwd(), summaryPath)}`);
}

main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
});
