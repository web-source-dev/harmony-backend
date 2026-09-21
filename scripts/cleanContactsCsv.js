/**
 * Cleans a contacts CSV using the same KEEP / REVIEW / REMOVE rules as
 * cleanup-brevo.js. Matches delete-brevo-cleanup.js: DROP review + remove,
 * except @harmony4all.org which is always kept.
 *
 * Usage:
 *   node scripts/cleanContactsCsv.js
 *   node scripts/cleanContactsCsv.js --input "contacts - contacts.csv"
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { classifyEmail } = require("./emailClassifier");

const PROTECTED_DOMAINS = new Set(["harmony4all.org"]);

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
        const token = args[i];
        if (!token?.startsWith("--")) continue;
        const key = token.replace(/^--/, "");
        const next = args[i + 1];
        if (next && !next.startsWith("--")) {
            parsed[key] = next;
            i++;
        } else {
            parsed[key] = "true";
        }
    }
    return parsed;
}

function csvEscape(value) {
    if (value === null || value === undefined) {
        return "";
    }
    const stringValue = String(value);
    if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n") ||
        stringValue.includes("\r")
    ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function writeCsv(filename, headers, rows) {
    const lines = [
        headers.map(csvEscape).join(","),
        ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
    ];
    fs.writeFileSync(filename, lines.join("\n") + "\n", "utf8");
}

function isProtectedEmail(email) {
    const domain = String(email || "").trim().toLowerCase().split("@")[1] || "";
    return PROTECTED_DOMAINS.has(domain);
}

function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        let headers = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on("headers", (headerList) => {
                headers = headerList;
            })
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve({ headers, rows }))
            .on("error", reject);
    });
}

async function main() {
    const args = parseArgs();
    const inputPath = path.resolve(
        __dirname,
        "..",
        args.input || "contacts - contacts.csv"
    );

    if (!fs.existsSync(inputPath)) {
        console.error(`Missing input file: ${inputPath}`);
        process.exit(1);
    }

    const outputDir = path.join(__dirname, "..", "contacts-cleanup");
    fs.mkdirSync(outputDir, { recursive: true });

    const cleanedPath = path.join(__dirname, "..", "contacts - contacts-cleaned.csv");
    const { headers, rows } = await readCsv(inputPath);

    const emailHeader =
        headers.find((header) => header.trim().toLowerCase() === "email 1") ||
        headers.find((header) => header.toLowerCase().includes("email")) ||
        "Email 1";

    const keep = [];
    const remove = [];
    const review = [];
    const seenEmails = new Set();
    let duplicateCount = 0;
    let protectedKept = 0;

    for (const row of rows) {
        const email = (row[emailHeader] || "").trim();
        const classification = classifyEmail(email);
        const emailKey = email.toLowerCase();
        const protectedAddr = isProtectedEmail(email);
        const keepThis =
            classification.category === "KEEP" || protectedAddr;

        const reportRow = {
            email,
            category: protectedAddr && classification.category !== "KEEP"
                ? "KEEP"
                : classification.category,
            reason: protectedAddr && classification.category !== "KEEP"
                ? `Protected domain: ${emailKey.split("@")[1]}`
                : classification.reason,
            firstName: row["First Name"] || "",
            lastName: row["Last Name"] || "",
        };

        if (!keepThis) {
            if (classification.category === "REVIEW") {
                review.push(reportRow);
            } else {
                remove.push(reportRow);
            }
            continue;
        }

        if (emailKey && seenEmails.has(emailKey)) {
            duplicateCount += 1;
            continue;
        }
        if (emailKey) {
            seenEmails.add(emailKey);
        }
        if (protectedAddr && classification.category !== "KEEP") {
            protectedKept += 1;
        }
        keep.push(row);
    }

    writeCsv(cleanedPath, headers, keep);
    writeCsv(
        path.join(outputDir, "remove.csv"),
        ["email", "category", "reason", "firstName", "lastName"],
        remove
    );
    writeCsv(
        path.join(outputDir, "review.csv"),
        ["email", "category", "reason", "firstName", "lastName"],
        review
    );

    const summary = {
        generatedAt: new Date().toISOString(),
        input: path.basename(inputPath),
        output: path.basename(cleanedPath),
        totalRows: rows.length,
        keep: keep.length,
        remove: remove.length,
        review: review.length,
        duplicatesDropped: duplicateCount,
        protectedKept,
        note: "Cleaned file is KEEP contacts plus @harmony4all.org. REVIEW and REMOVE were dropped, matching delete-brevo-cleanup.js.",
    };

    fs.writeFileSync(
        path.join(outputDir, "summary.json"),
        JSON.stringify(summary, null, 2),
        "utf8"
    );

    console.log("");
    console.log("==============================================");
    console.log("       CONTACTS CSV CLEANUP");
    console.log("==============================================");
    console.log("");
    console.log(`Input:   ${inputPath}`);
    console.log(`Total:   ${rows.length}`);
    console.log(`KEEP:    ${keep.length}`);
    console.log(`REMOVE:  ${remove.length}`);
    console.log(`REVIEW:  ${review.length}`);
    console.log(`Dupes:   ${duplicateCount}`);
    console.log(`Protected kept: ${protectedKept}`);
    console.log("");
    console.log(`Cleaned file: ${cleanedPath}`);
    console.log("Dropped lists:");
    console.log("  contacts-cleanup/remove.csv");
    console.log("  contacts-cleanup/review.csv");
    console.log("");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
