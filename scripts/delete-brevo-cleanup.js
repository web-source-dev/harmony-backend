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

const CLEANUP_DIR = path.join(__dirname, "..", "brevo-cleanup");
const FILES = [
    path.join(CLEANUP_DIR, "remove-all.csv"),
    path.join(CLEANUP_DIR, "review-all.csv"),
];

/*
 * Never delete our own org addresses.
 */
const PROTECTED_DOMAINS = new Set(["harmony4all.org"]);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCsvLine(line) {
    const parts = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
        const c = line[i];

        if (c === '"') {
            if (inQ && line[i + 1] === '"') {
                cur += '"';
                i++;
                continue;
            }
            inQ = !inQ;
            continue;
        }

        if (c === "," && !inQ) {
            parts.push(cur);
            cur = "";
            continue;
        }

        cur += c;
    }

    parts.push(cur);
    return parts;
}

function loadTargets() {
    const byKey = new Map();

    for (const file of FILES) {
        if (!fs.existsSync(file)) {
            console.error(`❌ Missing file: ${file}`);
            process.exit(1);
        }

        const lines = fs
            .readFileSync(file, "utf8")
            .split(/\r?\n/)
            .filter(Boolean);

        // skip header
        for (const line of lines.slice(1)) {
            const cols = parseCsvLine(line);
            const listId = cols[0];
            const id = cols[1];
            const email = (cols[2] || "").trim().toLowerCase();
            const category = cols[3] || "";
            const reason = cols[4] || "";

            const key = email || `id:${id}`;

            if (!byKey.has(key)) {
                byKey.set(key, {
                    listId,
                    id,
                    email,
                    category,
                    reason,
                    source: path.basename(file),
                });
            }
        }
    }

    return [...byKey.values()];
}

async function deleteContact(target) {
    if (target.email) {
        const domain = target.email.split("@")[1] || "";

        if (PROTECTED_DOMAINS.has(domain)) {
            return {
                status: "skipped",
                detail: `Protected domain: ${domain}`,
            };
        }

        try {
            await axios.delete(
                `${API}/contacts/${encodeURIComponent(target.email)}`,
                { headers }
            );

            return { status: "deleted", detail: "Deleted by email" };
        } catch (error) {
            const code = error.response?.status;
            const data = error.response?.data;

            if (code === 404) {
                return { status: "missing", detail: "Already gone / not found" };
            }

            return {
                status: "error",
                detail: data?.message || error.message,
            };
        }
    }

    if (target.id) {
        try {
            await axios.delete(`${API}/contacts/${encodeURIComponent(target.id)}`, {
                headers,
                params: { identifierType: "contact_id" },
            });

            return { status: "deleted", detail: "Deleted by contact id" };
        } catch (error) {
            const code = error.response?.status;
            const data = error.response?.data;

            if (code === 404) {
                return { status: "missing", detail: "Already gone / not found" };
            }

            return {
                status: "error",
                detail: data?.message || error.message,
            };
        }
    }

    return { status: "error", detail: "No email or id" };
}

async function main() {
    console.log("");
    console.log("==============================================");
    console.log("   BREVO DELETE REMOVE + REVIEW CONTACTS");
    console.log("==============================================");
    console.log("");
    console.log("Sources:");
    console.log("  - brevo-cleanup/remove-all.csv");
    console.log("  - brevo-cleanup/review-all.csv");
    console.log("Protected: @harmony4all.org (will NOT be deleted)");
    console.log("");

    const targets = loadTargets();

    console.log(`Targets to process: ${targets.length}`);
    console.log("");

    const results = {
        deleted: 0,
        skipped: 0,
        missing: 0,
        error: 0,
    };

    const logRows = [
        "email,id,category,source,status,detail",
    ];

    let i = 0;

    for (const target of targets) {
        i += 1;
        const label = target.email || `(id:${target.id})`;

        process.stdout.write(
            `[${i}/${targets.length}] ${label} ... `
        );

        const result = await deleteContact(target);

        results[result.status] = (results[result.status] || 0) + 1;

        console.log(`${result.status.toUpperCase()} (${result.detail})`);

        logRows.push(
            [
                target.email,
                target.id,
                target.category,
                target.source,
                result.status,
                `"${String(result.detail).replace(/"/g, '""')}"`,
            ].join(",")
        );

        // Be gentle with Brevo rate limits
        await sleep(120);
    }

    if (!fs.existsSync(CLEANUP_DIR)) {
        fs.mkdirSync(CLEANUP_DIR, { recursive: true });
    }

    const logPath = path.join(CLEANUP_DIR, "delete-log.csv");
    fs.writeFileSync(logPath, logRows.join("\n"), "utf8");

    const summary = {
        generatedAt: new Date().toISOString(),
        totalTargets: targets.length,
        ...results,
        logFile: "brevo-cleanup/delete-log.csv",
    };

    fs.writeFileSync(
        path.join(CLEANUP_DIR, "delete-summary.json"),
        JSON.stringify(summary, null, 2),
        "utf8"
    );

    console.log("");
    console.log("==============================================");
    console.log("                 DONE");
    console.log("==============================================");
    console.log(`Deleted: ${results.deleted}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Missing: ${results.missing}`);
    console.log(`Errors:  ${results.error}`);
    console.log("");
    console.log("Log: brevo-cleanup/delete-log.csv");
    console.log("");
}

main().catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
});
