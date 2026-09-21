require("dotenv").config();

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const API_KEY = process.env.BREVO_API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const OUTPUT_PATH = path.join(__dirname, "..", "phone-formatted.txt");

if (!API_KEY) {
  console.error("BREVO_API_KEY is missing in .env");
  process.exit(1);
}

if (!MONGO_URI) {
  console.error("MONGO_URI is missing in .env");
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

function isValidUSNumber(digits) {
  let d = digits;
  if (d.length === 11 && d.startsWith("1")) {
    d = d.slice(1);
  }
  if (d.length !== 10) return false;
  if (/^[01]/.test(d.slice(0, 3))) return false;
  if (/^[01]/.test(d.slice(3, 6))) return false;
  if (d === "1234567890" || /^(\d)\1{9}$/.test(d)) return false;
  return true;
}

function toDashedPhone(raw) {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!isValidUSNumber(digits)) return null;
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function looksLikePhone(value) {
  if (value === null || value === undefined) return false;
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 7;
}

function getPhonesFromBrevoContact(contact) {
  const attrs = contact.attributes || {};
  const found = [];

  for (const key of PHONE_ATTRIBUTE_KEYS) {
    if (looksLikePhone(attrs[key])) {
      found.push(String(attrs[key]).trim());
    }
  }

  for (const [key, value] of Object.entries(attrs)) {
    const upper = key.toUpperCase();
    if (PHONE_ATTRIBUTE_KEYS.includes(upper)) continue;
    if (/(PHONE|SMS|MOBILE|CELL|WHATSAPP|TELEPHONE|TEL)/i.test(key) && looksLikePhone(value)) {
      found.push(String(value).trim());
    }
  }

  return found;
}

async function fetchAllBrevoContacts() {
  const contacts = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    console.log(`Brevo: fetching contacts ${offset + 1} – ${offset + limit}...`);
    const response = await axios.get(`${API}/contacts`, {
      headers,
      params: { limit, offset, sort: "asc" },
    });
    const batch = response.data.contacts || [];
    contacts.push(...batch);
    console.log(`  received ${batch.length} (total so far: ${contacts.length})`);
    if (batch.length < limit) break;
    offset += limit;
    await sleep(300);
  }

  return contacts;
}

function loadExistingPhones() {
  if (!fs.existsSync(OUTPUT_PATH)) return [];
  return fs
    .readFileSync(OUTPUT_PATH, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function collectFromMongo() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const phones = [];

  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name);
  console.log(`MongoDB collections: ${names.join(", ")}`);

  // Customers: phone, phone1, phone2
  if (names.includes("customers")) {
    const docs = await db
      .collection("customers")
      .find({}, { projection: { phone: 1, phone1: 1, phone2: 1 } })
      .toArray();
    for (const doc of docs) {
      for (const field of ["phone", "phone1", "phone2"]) {
        if (doc[field]) phones.push(doc[field]);
      }
    }
    console.log(`Mongo customers scanned: ${docs.length}`);
  }

  // Contacts
  if (names.includes("contacts")) {
    const docs = await db
      .collection("contacts")
      .find({}, { projection: { phone: 1 } })
      .toArray();
    for (const doc of docs) {
      if (doc.phone) phones.push(doc.phone);
    }
    console.log(`Mongo contacts scanned: ${docs.length}`);
  }

  // Volunteers + emergency contact phone
  if (names.includes("volunteers")) {
    const docs = await db
      .collection("volunteers")
      .find({}, { projection: { phone: 1, "emergencyContact.phone": 1 } })
      .toArray();
    for (const doc of docs) {
      if (doc.phone) phones.push(doc.phone);
      if (doc.emergencyContact?.phone) phones.push(doc.emergencyContact.phone);
    }
    console.log(`Mongo volunteers scanned: ${docs.length}`);
  }

  // Donations
  if (names.includes("donations")) {
    const docs = await db
      .collection("donations")
      .find({}, { projection: { phone: 1 } })
      .toArray();
    for (const doc of docs) {
      if (doc.phone) phones.push(doc.phone);
    }
    console.log(`Mongo donations scanned: ${docs.length}`);
  }

  // Partnership agreements
  const partnershipNames = names.filter((n) =>
    /partnership/i.test(n)
  );
  for (const name of partnershipNames) {
    const docs = await db.collection(name).find({}).toArray();
    for (const doc of docs) {
      if (doc.organizer?.phone) phones.push(doc.organizer.phone);
      if (doc.venueHost?.phone) phones.push(doc.venueHost.phone);
    }
    console.log(`Mongo ${name} scanned: ${docs.length}`);
  }

  // Fallback: scan any string field that looks like a phone across remaining collections
  // (skip large/binary-heavy ones by only checking known phone-like keys)
  const knownHandled = new Set([
    "customers",
    "contacts",
    "volunteers",
    "donations",
    ...partnershipNames,
  ]);

  for (const name of names) {
    if (knownHandled.has(name)) continue;
    const sample = await db.collection(name).findOne({});
    if (!sample) continue;
    const phoneKeys = Object.keys(sample).filter((k) =>
      /phone|sms|mobile|cell|tel/i.test(k)
    );
    if (phoneKeys.length === 0) continue;

    const projection = {};
    for (const key of phoneKeys) projection[key] = 1;
    const docs = await db.collection(name).find({}, { projection }).toArray();
    for (const doc of docs) {
      for (const key of phoneKeys) {
        const value = doc[key];
        if (typeof value === "string" && looksLikePhone(value)) {
          phones.push(value);
        }
      }
    }
    console.log(`Mongo ${name} (phone-like fields) scanned: ${docs.length}`);
  }

  return phones;
}

async function main() {
  console.log("========================================");
  console.log("  Collect unique phones → phone-formatted.txt");
  console.log("========================================\n");

  const uniqueByDigits = new Map(); // digits10 -> dashed
  const stats = {
    existing: 0,
    brevoRaw: 0,
    mongoRaw: 0,
    invalidSkipped: 0,
  };

  function addPhone(raw, source) {
    const dashed = toDashedPhone(raw);
    if (!dashed) {
      stats.invalidSkipped += 1;
      return;
    }
    const digits = dashed.replace(/\D/g, "");
    if (!uniqueByDigits.has(digits)) {
      uniqueByDigits.set(digits, dashed);
    }
  }

  // 1) Keep existing list
  const existing = loadExistingPhones();
  stats.existing = existing.length;
  for (const phone of existing) addPhone(phone, "existing");
  console.log(`Existing file rows: ${existing.length}`);
  console.log(`Unique after existing: ${uniqueByDigits.size}\n`);

  // 2) Brevo
  const brevoContacts = await fetchAllBrevoContacts();
  for (const contact of brevoContacts) {
    const phones = getPhonesFromBrevoContact(contact);
    for (const phone of phones) {
      stats.brevoRaw += 1;
      addPhone(phone, "brevo");
    }
  }
  console.log(`Brevo raw phone values: ${stats.brevoRaw}`);
  console.log(`Unique after Brevo: ${uniqueByDigits.size}\n`);

  // 3) MongoDB (Harmony4All)
  console.log("Connecting to MongoDB...");
  try {
    const mongoPhones = await collectFromMongo();
    stats.mongoRaw = mongoPhones.length;
    for (const phone of mongoPhones) addPhone(phone, "mongo");
    console.log(`Mongo raw phone values: ${stats.mongoRaw}`);
    console.log(`Unique after Mongo: ${uniqueByDigits.size}\n`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }

  const sorted = [...uniqueByDigits.values()].sort((a, b) =>
    a.replace(/\D/g, "").localeCompare(b.replace(/\D/g, ""))
  );

  fs.writeFileSync(OUTPUT_PATH, sorted.join("\n") + "\n", "utf8");

  console.log("========================================");
  console.log("  DONE");
  console.log("========================================");
  console.log(`Existing rows loaded: ${stats.existing}`);
  console.log(`Brevo raw values: ${stats.brevoRaw}`);
  console.log(`Mongo raw values: ${stats.mongoRaw}`);
  console.log(`Invalid skipped: ${stats.invalidSkipped}`);
  console.log(`Unique valid phones written: ${sorted.length}`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Collect phones failed:", error.response?.data || error.message);
  process.exit(1);
});
