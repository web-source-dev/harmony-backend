require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.BREVO_API_KEY;

/**
 * Supports either:
 *   BREVO_LIST_IDS=3,4
 *   BREVO_LIST_ID=3,4
 *   BREVO_LIST_ID=3
 */
function parseListIds() {
    const raw =
        process.env.BREVO_LIST_IDS ||
        process.env.BREVO_LIST_ID ||
        "";

    const ids = String(raw)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

    return [...new Set(ids)];
}

const LIST_IDS = parseListIds();

if (!API_KEY) {
    console.error("❌ BREVO_API_KEY is missing in .env");
    process.exit(1);
}

if (LIST_IDS.length === 0) {
    console.error(
        "❌ Set BREVO_LIST_IDS (or BREVO_LIST_ID) in .env, e.g. BREVO_LIST_IDS=3,4"
    );
    process.exit(1);
}

const API = "https://api.brevo.com/v3";

const headers = {
    "api-key": API_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
};

/*
|--------------------------------------------------------------------------
| EMAIL PATTERNS
|--------------------------------------------------------------------------
|
| These are strong indicators that the mailbox is not an individual
| marketing contact.
|
*/

const REMOVE_LOCAL_PARTS = new Set([
    "noreply",
    "no-reply",
    "no_reply",
    "donotreply",
    "do-not-reply",
    "do_not_reply",
    "notifications",
    "notification",
    "mailer",
    "mailers",
    "automated",
    "automation",
    "system",
    "alerts",
    "alert",
    "security",
    "bounce",
    "bounces",
    "daemon",
    "postmaster",
    "webmaster",
    "wordpress",
    "newsletter",
    "newsletters",
    "updates",
    "update",
    "billing",
    "invoices",
    "invoice",
    "receipts",
    "receipt",
    "orders",
    "order",
    "tracking",
    "unsubscribe",
    "invitations",
    "pageupdates",
    "reminders",
]);

/*
|--------------------------------------------------------------------------
| GENERIC / ROLE BASED ADDRESSES
|--------------------------------------------------------------------------
|
| These aren't necessarily bad addresses.
| We put them into REVIEW instead of automatically removing them.
|
*/

const REVIEW_LOCAL_PARTS = new Set([
    "info",
    "information",
    "contact",
    "hello",
    "hi",
    "office",
    "admin",
    "administrator",
    "support",
    "help",
    "helpdesk",
    "sales",
    "marketing",
    "business",
    "team",
    "service",
    "customerservice",
    "customer.service",
    "customersupport",
    "customer.support",
    "care",
    "enquiries",
    "enquiry",
    "inquiries",
    "inquiry",
    "reception",
    "onboarding",
    "events",
    "news",
    "announcements",
    "press",
    "media",
    "partners",
    "partnerships",
]);

/*
|--------------------------------------------------------------------------
| LOCAL PARTS THAT SHOULD DEFINITELY NOT BE MARKETED TO
|--------------------------------------------------------------------------
*/

const STRONG_REMOVE_WORDS = [
    "noreply",
    "no-reply",
    "no_reply",
    "donotreply",
    "do-not-reply",
    "do_not_reply",
    "notification",
    "notifications",
    "automated",
    "automation",
    "mailer",
    "system",
    "alerts",
    "bounce",
    "unsubscribe",
];

/*
|--------------------------------------------------------------------------
| TEMPORARY / DISPOSABLE / FAKE EMAIL DOMAINS
|--------------------------------------------------------------------------
*/

const DISPOSABLE_DOMAINS = new Set([
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
    "tempmail.com",
    "temp-mail.org",
    "yopmail.com",
    "sharklasers.com",
    "guerrillamailblock.com",
    "getnada.com",
    "trashmail.com",
    "maildrop.cc",
    "dispostable.com",
    "tmail.com",
    "test.com",
    "example.com",
    "example.org",
    "example.net",
    "localhost",
    "invalid",
    "local",
]);

/*
|--------------------------------------------------------------------------
| PLATFORM / SYSTEM / NON-HUMAN DOMAINS
|--------------------------------------------------------------------------
|
| Exact domains that are never useful marketing contacts.
|
*/

const REMOVE_EXACT_DOMAINS = new Set([
    "offline-members-wix.com",
    "wixforms.com",
    "wixsiteautomations.com",
    "facebookmail.com",
    "quora.com",
    "linkedin.com",
    "mailchimp.com",
    "send.zapier.com",
    "notice.alibaba.com",
    "service.alibaba.com",
    "engage.canva.com",
    "email.submittable.com",
    "newsletter.zeffy.com",
    "marketing.descript.com",
    "mail.descript.com",
    "notifications.intuit.com",
    "notification.intuit.com",
    "mkt.intuit.com",
    "eq.intuit.com",
    "appcenter.intuit.com",
    "quickbooks.intuit.com",
    "notifications.t-mobile.com",
    "feedback.t-mobile.com",
    "tmobiz.t-mobile.com",
    "e.godaddy.com",
    "e.techsoup.org",
    "email.aarp.org",
    "email.anthropic.com",
    "email.alibaba.com",
    "email.upwork.com",
    "email.musicarts.com",
    "t.upwork.com",
    "mail-relay.blinq.me",
    "blog.wixnotifications.com",
    "emails.wix.com",
    "messages.wix.com",
    "notification.wix.com",
    "notifications.wix.com",
    "team.wix.com",
    "mail.beehiiv.com",
    "mailgun.waiverforever.com",
    "notifybf2.hubspot.com",
    "pb07.wixemails.com",
    "communications.paypal.com",
]);

/*
|--------------------------------------------------------------------------
| DOMAIN SUFFIX / CONTAINS RULES FOR PLATFORM JUNK
|--------------------------------------------------------------------------
*/

const REMOVE_DOMAIN_SUFFIXES = [
    ".myactivecampaign.com",
    ".mailchimpapp.com",
    ".wixemails.com",
    ".wixnotifications.com",
    ".mailchimp.com",
    ".sendgrid.net",
    ".amazonses.com",
    ".mailgun.org",
    ".intercom-mail.com",
    ".klaviyomail.com",
];

const REMOVE_DOMAIN_CONTAINS = [
    "offline-members-wix",
    "wixforms",
    "wixsiteautomations",
    "wixnotifications",
    "wixemails",
    "mailchimpapp",
    "myactivecampaign",
    "facebookmail",
    "mail-relay",
    "privaterelay.appleid",
];

/*
|--------------------------------------------------------------------------
| MARKETING / NOTIFICATION SUBDOMAIN PREFIXES
|--------------------------------------------------------------------------
|
| e.g. notifications.intuit.com, engage.canva.com, send.zapier.com
| Kept conservative so real orgs like mail.culture.nyc.gov stay KEEP/REVIEW.
|
*/

const REMOVE_SUBDOMAIN_PREFIXES = [
    "notifications.",
    "notification.",
    "noreply.",
    "no-reply.",
    "donotreply.",
    "bounce.",
    "bounces.",
    "mailer.",
    "email.",
    "emails.",
    "newsletter.",
    "newsletters.",
    "marketing.",
    "engage.",
    "notice.",
    "send.",
    "updates.",
    "messages.",
    "em.",
    "e.",
];

const UUID_LOCAL_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const NOREPLY_IN_LOCAL_RE =
    /(^|[+._-])(no[_-]?reply|do[_-]?not[_-]?reply|donotreply)([+._-]|$)/;

function domainMatchesRemoveRules(domain) {
    if (REMOVE_EXACT_DOMAINS.has(domain)) {
        return `Platform/system domain: ${domain}`;
    }

    for (const suffix of REMOVE_DOMAIN_SUFFIXES) {
        if (domain.endsWith(suffix) || domain === suffix.slice(1)) {
            return `Platform/system domain suffix: ${suffix}`;
        }
    }

    for (const piece of REMOVE_DOMAIN_CONTAINS) {
        if (domain.includes(piece)) {
            return `Platform/system domain pattern: ${piece}`;
        }
    }

    for (const prefix of REMOVE_SUBDOMAIN_PREFIXES) {
        if (domain.startsWith(prefix)) {
            return `Marketing/notification subdomain: ${prefix}*`;
        }
    }

    return null;
}

/*
|--------------------------------------------------------------------------
| CLASSIFY EMAIL
|--------------------------------------------------------------------------
*/

function classifyEmail(email) {
    if (!email || typeof email !== "string") {
        return {
            category: "REMOVE",
            reason: "Missing email",
        };
    }

    email = email.trim().toLowerCase();

    const parts = email.split("@");

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return {
            category: "REMOVE",
            reason: "Invalid email format",
        };
    }

    const local = parts[0];
    const domain = parts[1];

    /*
    |--------------------------------------------------------------------------
    | Disposable / fake domain
    |--------------------------------------------------------------------------
    */

    if (DISPOSABLE_DOMAINS.has(domain)) {
        return {
            category: "REMOVE",
            reason: "Disposable/fake email domain",
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Platform / system / non-human domains
    |--------------------------------------------------------------------------
    */

    const domainReason = domainMatchesRemoveRules(domain);
    if (domainReason) {
        return {
            category: "REMOVE",
            reason: domainReason,
        };
    }

    /*
    |--------------------------------------------------------------------------
    | UUID / machine-generated local part
    |--------------------------------------------------------------------------
    */

    if (UUID_LOCAL_RE.test(local)) {
        return {
            category: "REMOVE",
            reason: "UUID/machine-generated mailbox",
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Form / ticket reply-to relays (reply-to+hash@...)
    |--------------------------------------------------------------------------
    */

    if (
        local.startsWith("reply-to+") ||
        local.startsWith("reply+") ||
        local.startsWith("connect+")
    ) {
        return {
            category: "REMOVE",
            reason: "Form/relay reply address",
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Noreply / do-not-reply anywhere in local part
    |--------------------------------------------------------------------------
    */

    if (NOREPLY_IN_LOCAL_RE.test(local)) {
        return {
            category: "REMOVE",
            reason: "Noreply/do-not-reply mailbox",
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Quora digest / space style locals (even if domain list changes)
    |--------------------------------------------------------------------------
    */

    if (
        domain === "quora.com" ||
        local.endsWith("-space") ||
        local.endsWith("-digest") ||
        local.includes("-quora-digest")
    ) {
        if (domain === "quora.com" || local.includes("quora")) {
            return {
                category: "REMOVE",
                reason: "Quora digest/space mailbox",
            };
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Exact automated/system local parts
    |--------------------------------------------------------------------------
    */

    if (REMOVE_LOCAL_PARTS.has(local)) {
        return {
            category: "REMOVE",
            reason: `Automated/system mailbox: ${local}`,
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Strong keyword detection (prefix or embedded with separators)
    |--------------------------------------------------------------------------
    */

    for (const word of STRONG_REMOVE_WORDS) {
        if (
            local === word ||
            local.startsWith(`${word}.`) ||
            local.startsWith(`${word}-`) ||
            local.startsWith(`${word}_`) ||
            local.endsWith(`-${word}`) ||
            local.endsWith(`.${word}`) ||
            local.endsWith(`_${word}`) ||
            local.includes(`-${word}-`) ||
            local.includes(`.${word}.`) ||
            local.includes(`_${word}_`) ||
            local.includes(`+${word}`)
        ) {
            return {
                category: "REMOVE",
                reason: `Automated/system pattern: ${word}`,
            };
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Generic role mailbox
    |--------------------------------------------------------------------------
    */

    if (REVIEW_LOCAL_PARTS.has(local)) {
        return {
            category: "REVIEW",
            reason: `Generic/role mailbox: ${local}`,
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Pattern-based generic mailbox
    |--------------------------------------------------------------------------
    */

    const genericPatterns = [
        /^support\d*$/,
        /^sales\d*$/,
        /^info\d*$/,
        /^contact\d*$/,
        /^admin\d*$/,
        /^help\d*$/,
        /^service\d*$/,
        /^marketing\d*$/,
        /^team\d*$/,
        /^office\d*$/,
        /^news\d*$/,
        /^events\d*$/,
    ];

    if (genericPatterns.some((pattern) => pattern.test(local))) {
        return {
            category: "REVIEW",
            reason: `Generic role mailbox: ${local}`,
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Looks like a personal address
    |--------------------------------------------------------------------------
    */

    return {
        category: "KEEP",
        reason: "Looks like an individual mailbox",
    };
}

/*
|--------------------------------------------------------------------------
| FETCH CONTACTS
|--------------------------------------------------------------------------
*/

async function getContactsFromList(listId) {
    const contacts = [];

    let offset = 0;
    const limit = 500;

    while (true) {
        console.log(
            `📥 [List ${listId}] Fetching contacts ${offset + 1} - ${offset + limit}...`
        );

        try {
            const response = await axios.get(
                `${API}/contacts/lists/${listId}/contacts`,
                {
                    headers,
                    params: {
                        limit,
                        offset,
                        sort: "asc",
                    },
                }
            );

            const batch = response.data.contacts || [];

            contacts.push(...batch);

            console.log(`   Received ${batch.length}`);

            if (batch.length < limit) {
                break;
            }

            offset += limit;

            /*
             * Small delay to be friendly with the API.
             */
            await sleep(300);
        } catch (error) {
            console.error(
                `❌ Failed to fetch contacts for list ${listId}:`,
                error.response?.data || error.message
            );

            process.exit(1);
        }
    }

    return contacts;
}

/*
|--------------------------------------------------------------------------
| CSV ESCAPING
|--------------------------------------------------------------------------
*/

function csvEscape(value) {
    if (value === null || value === undefined) {
        return "";
    }

    const stringValue = String(value);

    if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
    ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

/*
|--------------------------------------------------------------------------
| WRITE CSV
|--------------------------------------------------------------------------
*/

function writeCSV(filename, rows) {
    const headers = [
        "listId",
        "id",
        "email",
        "category",
        "reason",
        "firstName",
        "lastName",
        "createdAt",
    ];

    const lines = [
        headers.join(","),
        ...rows.map((row) =>
            [
                row.listId,
                row.id,
                row.email,
                row.category,
                row.reason,
                row.firstName,
                row.lastName,
                row.createdAt,
            ]
                .map(csvEscape)
                .join(",")
        ),
    ];

    fs.writeFileSync(filename, lines.join("\n"), "utf8");

    console.log(`📄 Created ${filename}`);
}

/*
|--------------------------------------------------------------------------
| SLEEP
|--------------------------------------------------------------------------
*/

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
|--------------------------------------------------------------------------
| PROCESS ONE LIST
|--------------------------------------------------------------------------
*/

async function processList(listId, outputDir) {
    console.log("");
    console.log("----------------------------------------------");
    console.log(`Processing List ID: ${listId}`);
    console.log("----------------------------------------------");
    console.log("");

    const contacts = await getContactsFromList(listId);

    console.log("");
    console.log(`✅ [List ${listId}] Total contacts fetched: ${contacts.length}`);
    console.log("");

    const results = contacts.map((contact) => {
        const classification = classifyEmail(contact.email);

        return {
            listId,
            id: contact.id,
            email: contact.email || "",
            category: classification.category,
            reason: classification.reason,
            firstName: contact.attributes?.FIRSTNAME || "",
            lastName: contact.attributes?.LASTNAME || "",
            createdAt: contact.createdAt || "",
        };
    });

    const keep = results.filter((x) => x.category === "KEEP");
    const remove = results.filter((x) => x.category === "REMOVE");
    const review = results.filter((x) => x.category === "REVIEW");

    const listDir = path.join(outputDir, `list-${listId}`);

    if (!fs.existsSync(listDir)) {
        fs.mkdirSync(listDir, { recursive: true });
    }

    writeCSV(path.join(listDir, "keep.csv"), keep);
    writeCSV(path.join(listDir, "remove.csv"), remove);
    writeCSV(path.join(listDir, "review.csv"), review);

    const summary = {
        generatedAt: new Date().toISOString(),
        listId,
        total: results.length,
        keep: keep.length,
        remove: remove.length,
        review: review.length,
    };

    fs.writeFileSync(
        path.join(listDir, "summary.json"),
        JSON.stringify(summary, null, 2),
        "utf8"
    );

    console.log("");
    console.log(`[List ${listId}] Total:  ${results.length}`);
    console.log(`[List ${listId}] KEEP:   ${keep.length}`);
    console.log(`[List ${listId}] REMOVE: ${remove.length}`);
    console.log(`[List ${listId}] REVIEW: ${review.length}`);

    return { results, keep, remove, review, summary };
}

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

async function main() {
    console.log("");
    console.log("==============================================");
    console.log("       BREVO CONTACT CLEANUP");
    console.log("==============================================");
    console.log("");
    console.log(`List IDs: ${LIST_IDS.join(", ")}`);
    console.log("");

    const outputDir = "brevo-cleanup";

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const allKeep = [];
    const allRemove = [];
    const allReview = [];
    const listSummaries = [];

    for (const listId of LIST_IDS) {
        const { keep, remove, review, summary } = await processList(
            listId,
            outputDir
        );

        allKeep.push(...keep);
        allRemove.push(...remove);
        allReview.push(...review);
        listSummaries.push(summary);

        // Brief pause between lists
        await sleep(500);
    }

    /*
     * Combined reports across all lists
     */
    writeCSV(path.join(outputDir, "keep-all.csv"), allKeep);
    writeCSV(path.join(outputDir, "remove-all.csv"), allRemove);
    writeCSV(path.join(outputDir, "review-all.csv"), allReview);

    const combinedSummary = {
        generatedAt: new Date().toISOString(),
        listIds: LIST_IDS,
        lists: listSummaries,
        total: allKeep.length + allRemove.length + allReview.length,
        keep: allKeep.length,
        remove: allRemove.length,
        review: allReview.length,
    };

    fs.writeFileSync(
        path.join(outputDir, "summary.json"),
        JSON.stringify(combinedSummary, null, 2),
        "utf8"
    );

    console.log("");
    console.log("==============================================");
    console.log("            COMBINED RESULTS");
    console.log("==============================================");
    console.log("");
    console.log(`Lists:   ${LIST_IDS.join(", ")}`);
    console.log(`Total:   ${combinedSummary.total}`);
    console.log(`KEEP:    ${combinedSummary.keep}`);
    console.log(`REMOVE:  ${combinedSummary.remove}`);
    console.log(`REVIEW:  ${combinedSummary.review}`);
    console.log("");
    console.log("⚠️ NOTHING HAS BEEN DELETED OR REMOVED.");
    console.log("");
    console.log("Per-list reports:");
    for (const listId of LIST_IDS) {
        console.log(`  brevo-cleanup/list-${listId}/`);
    }
    console.log("");
    console.log("Combined reports:");
    console.log("  brevo-cleanup/remove-all.csv");
    console.log("  brevo-cleanup/review-all.csv");
    console.log("  brevo-cleanup/keep-all.csv");
    console.log("");
}

main().catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
});
