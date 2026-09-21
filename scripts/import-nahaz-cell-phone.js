require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.BREVO_API_KEY;
const LIST_NAME = "Nahaz's Cell Phone";
const FOLDER_ID = Number(process.env.BREVO_FOLDER_ID || 1);

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

function normalizePhone(raw) {
    if (!raw) {
        return "";
    }

    let digits = String(raw).replace(/\D/g, "");

    if (digits.length === 11 && digits.startsWith("1")) {
        digits = digits.slice(1);
    }

    if (digits.length !== 10) {
        return "";
    }

    return `+1${digits}`;
}

function loadContacts() {
    const filePath = path.join(__dirname, "..", "brevo-nahaz-cell", "contacts.json");
    const people = JSON.parse(fs.readFileSync(filePath, "utf8"));

    return people.map((person) => {
        const emails = (person.emails || [])
            .map((email) => String(email).trim().toLowerCase())
            .filter(Boolean);
        const phones = (person.phones || []).map(normalizePhone).filter(Boolean);

        return {
            firstName: person.firstName || "",
            lastName: person.lastName || "",
            email: emails[0] || "",
            secondaryEmail: emails[1] || "",
            extraEmails: emails.slice(2),
            sms: phones[0] || "",
            secondarySms: phones[1] || "",
            tertiarySms: phones[2] || "",
            emailCorrection: person.emailCorrection || "",
            displayName: [person.firstName, person.lastName].filter(Boolean).join(" "),
        };
    });
}

async function getLists() {
    const lists = [];
    let offset = 0;
    const limit = 50;

    while (true) {
        const response = await axios.get(`${API}/contacts/lists`, {
            headers,
            params: { limit, offset },
        });
        const batch = response.data.lists || [];
        lists.push(...batch);
        if (batch.length < limit) {
            break;
        }
        offset += limit;
    }

    return lists;
}

async function getList(listId) {
    const response = await axios.get(`${API}/contacts/lists/${listId}`, {
        headers,
    });
    return response.data;
}

async function createList(name, folderId) {
    const response = await axios.post(
        `${API}/contacts/lists`,
        { name, folderId },
        { headers }
    );
    return response.data;
}

function errorPayload(error) {
    return error.response?.data || { message: error.message };
}

function isDuplicateSmsError(error) {
    const data = error.response?.data || {};
    const message = String(data.message || "").toLowerCase();
    return (
        data.code === "duplicate_parameter" &&
        (message.includes("sms") || message.includes("mobile"))
    );
}

function isInvalidEmailError(error) {
    const data = error.response?.data || {};
    const message = String(data.message || "").toLowerCase();
    return (
        data.code === "invalid_parameter" &&
        (message.includes("email") || message.includes("valid"))
    );
}

async function createOrUpdateContact(contact, listId, options = {}) {
    const { omitSms = false, omitEmail = false } = options;

    const attributes = {
        FIRSTNAME: contact.firstName,
        LASTNAME: contact.lastName,
        NOTES: contact.extraEmails.length
            ? `Additional emails: ${contact.extraEmails.join(", ")} | ${LIST_NAME}`
            : LIST_NAME,
    };

    if (!omitSms && contact.sms) {
        attributes.SMS = contact.sms;
    }
    if (contact.secondarySms) {
        attributes.SECONDARY_SMS = contact.secondarySms;
    }
    if (contact.tertiarySms) {
        attributes.TERTIARY_SMS = contact.tertiarySms;
    }
    if (contact.secondaryEmail) {
        attributes.SECONDARY_EMAIL = contact.secondaryEmail;
    }

    const body = {
        attributes,
        listIds: [listId],
        updateEnabled: true,
    };

    if (!omitEmail && contact.email) {
        body.email = contact.email;
    }

    const response = await axios.post(`${API}/contacts`, body, { headers });
    return response.data;
}

async function addIdentifierToList(listId, identifier) {
    const payload = identifier.includes("@")
        ? { emails: [identifier] }
        : { emails: [] };

    if (identifier.includes("@")) {
        await axios.post(
            `${API}/contacts/lists/${listId}/contacts/add`,
            { emails: [identifier] },
            { headers }
        );
        return;
    }

    await axios.post(
        `${API}/contacts/lists/${listId}/contacts/add`,
        { extIds: [] },
        { headers }
    );
}

async function addEmailsToList(listId, emails) {
    if (!emails.length) {
        return;
    }

    await axios.post(
        `${API}/contacts/lists/${listId}/contacts/add`,
        { emails },
        { headers }
    );
}

async function findContactBySms(sms) {
    const encoded = encodeURIComponent(sms);
    try {
        const response = await axios.get(`${API}/contacts/${encoded}`, {
            headers,
            params: { identifierType: "sms" },
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
}

async function importOne(contact, listId) {
    const result = {
        name: contact.displayName,
        email: contact.email || null,
        sms: contact.sms || null,
        status: "ok",
        detail: "",
        id: null,
    };

    try {
        const created = await createOrUpdateContact(contact, listId);
        result.id = created.id || created;
        result.detail = contact.email ? "created/updated by email" : "created/updated by SMS";
        return result;
    } catch (error) {
        if (isDuplicateSmsError(error) && contact.email) {
            try {
                const created = await createOrUpdateContact(contact, listId, {
                    omitSms: true,
                });
                result.id = created.id || created;
                result.status = "ok";
                result.detail =
                    "created/updated by email; SMS already used on another contact";
                return result;
            } catch (retryError) {
                result.status = "error";
                result.detail = JSON.stringify(errorPayload(retryError));
                return result;
            }
        }

        if (isDuplicateSmsError(error) && contact.sms && !contact.email) {
            try {
                const existing = await findContactBySms(contact.sms);
                if (existing?.email) {
                    await addEmailsToList(listId, [existing.email]);
                    result.email = existing.email;
                    result.id = existing.id || null;
                    result.status = "ok";
                    result.detail = "existing SMS contact added to list";
                    return result;
                }

                result.status = "error";
                result.detail =
                    "SMS already exists on another contact and could not be linked";
                return result;
            } catch (lookupError) {
                result.status = "error";
                result.detail = JSON.stringify(errorPayload(lookupError));
                return result;
            }
        }

        result.status = "error";
        result.detail = JSON.stringify(errorPayload(error));
        return result;
    }
}

async function main() {
    console.log("========================================");
    console.log("   IMPORT NAHAZ'S CELL PHONE LIST");
    console.log("========================================\n");

    const contacts = loadContacts();
    const withEmail = contacts.filter((c) => c.email).length;
    const smsOnly = contacts.filter((c) => !c.email && c.sms).length;

    console.log(`People to import: ${contacts.length}`);
    console.log(`With email: ${withEmail}`);
    console.log(`SMS only: ${smsOnly}\n`);

    const existingLists = await getLists();
    let list = existingLists.find(
        (item) => String(item.name).toLowerCase() === LIST_NAME.toLowerCase()
    );

    if (list) {
        console.log(`Using existing list #${list.id}: ${list.name}`);
    } else {
        const created = await createList(LIST_NAME, FOLDER_ID);
        list = { id: created.id, name: LIST_NAME };
        console.log(`Created list #${list.id}: ${LIST_NAME}`);
    }

    const results = [];

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const label = contact.email || contact.sms || contact.displayName;
        process.stdout.write(
            `📤 ${i + 1}/${contacts.length} ${contact.displayName} (${label})... `
        );

        const result = await importOne(contact, list.id);
        results.push(result);

        if (result.status === "ok") {
            console.log(`ok — ${result.detail}`);
        } else {
            console.log(`FAILED — ${result.detail}`);
        }

        await sleep(250);
    }

    let listAfter = null;
    try {
        listAfter = await getList(list.id);
    } catch (error) {
        console.error(
            "⚠️ Could not reload list:",
            error.response?.data || error.message
        );
    }

    const ok = results.filter((r) => r.status === "ok");
    const failed = results.filter((r) => r.status === "error");
    const outputDir = path.join(__dirname, "..", "brevo-nahaz-cell");
    const summaryPath = path.join(outputDir, "import-summary.json");

    fs.writeFileSync(
        summaryPath,
        JSON.stringify(
            {
                importedAt: new Date().toISOString(),
                listId: list.id,
                listName: LIST_NAME,
                peopleAttempted: contacts.length,
                successCount: ok.length,
                failureCount: failed.length,
                uniqueSubscribers: listAfter?.uniqueSubscribers ?? null,
                results,
            },
            null,
            2
        ),
        "utf8"
    );

    console.log("\n========================================");
    console.log("   RESULTS");
    console.log("========================================");
    console.log(`List: ${LIST_NAME} (#${list.id})`);
    console.log(`Imported: ${ok.length}/${contacts.length}`);
    console.log(`Failed: ${failed.length}`);
    if (listAfter) {
        console.log(`List unique subscribers: ${listAfter.uniqueSubscribers}`);
    }
    if (failed.length) {
        console.log("\nFailures:");
        for (const item of failed) {
            console.log(`  - ${item.name}: ${item.detail}`);
        }
    }
    console.log(`Wrote: ${path.relative(process.cwd(), summaryPath)}`);
}

main().catch((error) => {
    console.error("❌ Script failed:", error.response?.data || error);
    process.exit(1);
});
