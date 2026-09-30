const { google } = require("googleapis");
const cron = require("node-cron");
const moment = require("moment-timezone");
const RsvpEvent = require("../models/rsvpEvent");
const EventRsvp = require("../models/eventRsvp");

// Mirrors RSVPs into a Google Spreadsheet:
//   • "Overview"                  — every event with its status and totals, linking to its tab
//   • one tab per event           — summary block on top, then one row per RSVP (rebuilt from MongoDB on every change)
//   • "RSVPs – No Active Event"   — submissions made while no event was live (one row per email, updated in place)
// MongoDB stays the source of truth; the sheet is a read-friendly copy. Every write runs in the background through
// a single queue, so a slow or failing Google API never delays the RSVP form.

const TIMEZONE = "America/New_York";
const OVERVIEW_TAB = "Overview";
const NO_EVENT_TAB = "RSVPs – No Active Event";
const DELETED_PREFIX = "Deleted – ";

const COLUMNS = ["First Name", "Last Name", "Email", "Cell Number", "People Attending", "Promotional Updates", "Submitted At (ET)"];
const COLUMN_WIDTHS = [150, 150, 260, 140, 150, 170, 190];
const OVERVIEW_COLUMNS = ["Event", "Event Date", "RSVPs Close", "Status", "RSVPs", "Expected Attendees", "Created"];
const OVERVIEW_WIDTHS = [300, 190, 150, 110, 90, 160, 130];
const COLUMN_COUNT = COLUMNS.length;

// Row positions (0-based): title, subtitle, blank, section headings, 5 summary rows, blank, table header, data
const SUMMARY_ROW = 4;
const SUMMARY_ROWS = 5;
const HEADER_ROW = 10;
const FIRST_DATA_ROW = HEADER_ROW + 1;
const DEFAULT_ROW_COUNT = 1000;
const MAX_TAB_NAME = 90;

const hex = (value) => {
  const n = parseInt(value.replace("#", ""), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
};
const COLORS = {
  brand: hex("#1F3A5F"),
  brandLight: hex("#E8EEF6"),
  stripe: hex("#F7F9FC"),
  white: hex("#FFFFFF"),
  muted: hex("#6B7280"),
  text: hex("#111827"),
};
const DATE_TIME_FORMAT = { type: "DATE_TIME", pattern: "mmm d, yyyy h:mm AM/PM" };

// ─── Config & client ───────────────────────────────────────────────────────

function getConfig() {
  const spreadsheetId = (process.env.GOOGLE_SHEETS_RSVP_SPREADSHEET_ID || "").trim();
  const clientEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  // Hosting dashboards usually store the key on one line with literal "\n"s, sometimes wrapped in quotes
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
  if (!spreadsheetId || !clientEmail || !privateKey.includes("PRIVATE KEY")) return null;
  return { spreadsheetId, clientEmail, privateKey };
}

const isEnabled = () => Boolean(getConfig());

const getSpreadsheetUrl = () => {
  const config = getConfig();
  return config ? `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit` : null;
};

let sheetsClient = null;
function sheetsApi() {
  if (!sheetsClient) {
    const { clientEmail, privateKey } = getConfig();
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

const spreadsheetId = () => getConfig().spreadsheetId;

// Retries rate limits (429) and Google server errors with backoff
async function withRetry(call, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const status = Number(error.response?.status || error.code);
      if (attempt >= attempts || !(status === 429 || status >= 500)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

async function getTabs() {
  const { data } = await withRetry(() =>
    sheetsApi().spreadsheets.get({
      spreadsheetId: spreadsheetId(),
      fields: "sheets.properties(sheetId,title,index,gridProperties.rowCount)",
    })
  );
  return (data.sheets || []).map(({ properties }) => ({
    sheetId: properties.sheetId,
    title: properties.title,
    index: properties.index,
    rowCount: properties.gridProperties?.rowCount || 0,
  }));
}

async function batchUpdate(requests) {
  if (!requests.length) return;
  await withRetry(() =>
    sheetsApi().spreadsheets.batchUpdate({ spreadsheetId: spreadsheetId(), requestBody: { requests } })
  );
}

// ─── Queue ─────────────────────────────────────────────────────────────────

// All sheet writes run one at a time. A keyed task that is already waiting is not queued twice, so a burst of
// RSVPs for the same event collapses into one rebuild (the key is released as the task starts, so changes made
// while it runs still get their own rebuild).
let queue = Promise.resolve();
const waiting = new Map();

function enqueue(key, task) {
  if (key && waiting.has(key)) return waiting.get(key);
  const run = queue.then(() => {
    if (key) waiting.delete(key);
    return task();
  });
  queue = run.catch(() => {});
  if (key) waiting.set(key, run);
  return run;
}

let warnedDisabled = false;
function inBackground(label, task) {
  if (!isEnabled()) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.log("Google Sheets RSVP sync is off (GOOGLE_SHEETS_RSVP_SPREADSHEET_ID / GOOGLE_SERVICE_ACCOUNT_* not set)");
    }
    return Promise.resolve();
  }
  return task().catch((error) => {
    console.error(`Google Sheets RSVP sync failed (${label}):`, error.response?.data?.error?.message || error.message);
  });
}

// ─── Cell helpers ──────────────────────────────────────────────────────────

// Values are written as typed cells (stringValue, never parsed), so user input such as "=..." can't become a formula
const cell = (value, format = {}) => {
  let userEnteredValue;
  if (value && typeof value === "object" && "formula" in value) userEnteredValue = { formulaValue: value.formula };
  else if (typeof value === "number") userEnteredValue = { numberValue: value };
  else if (value !== undefined && value !== null && value !== "") userEnteredValue = { stringValue: String(value) };
  return { ...(userEnteredValue && { userEnteredValue }), userEnteredFormat: { verticalAlignment: "MIDDLE", ...format } };
};
const empty = (format) => cell(null, format);
const formula = (text) => ({ formula: text });
const quoteText = (value) => String(value).replace(/"/g, '""');
const quoteTab = (title) => `'${title.replace(/'/g, "''")}'`;
const dataRange = (column) => `${column}${FIRST_DATA_ROW + 1}:${column}`;

// Google Sheets date serial for a moment, shown in New York time
const toSerial = (date) => {
  const local = moment(date).tz(TIMEZONE);
  return (local.valueOf() + local.utcOffset() * 60000) / 86400000 + 25569;
};

const formatEventDate = (date) => (date ? moment(date).tz(TIMEZONE).format("dddd, MMMM D, YYYY") : "—");
const formatEndDate = (date) => (date ? `${moment(date).tz(TIMEZONE).format("MMM D, YYYY")} (11:59 PM ET)` : "—");
const syncedAt = () => `Updated automatically from the Harmony 4 All RSVP form · Last synced ${moment().tz(TIMEZONE).format("MMM D, YYYY h:mm A")} ET`;

const hasEnded = (event) => Boolean(event.endDate) && new Date(event.endDate) < new Date();
const shortStatus = (event) => (event.isActive ? "Live" : hasEnded(event) ? "Ended" : "Inactive");
const longStatus = (event) =>
  event.isActive
    ? "Live — taking RSVPs on /rsvp"
    : hasEnded(event)
      ? "Ended — RSVPs are closed"
      : "Inactive — not shown on /rsvp";

const titleFormat = { textFormat: { bold: true, fontSize: 16, foregroundColor: COLORS.white }, backgroundColor: COLORS.brand };
const subtitleFormat = { textFormat: { italic: true, fontSize: 9, foregroundColor: COLORS.muted } };
const sectionFormat = { textFormat: { bold: true, fontSize: 10, foregroundColor: COLORS.brand }, backgroundColor: COLORS.brandLight };
const labelFormat = { textFormat: { bold: true, foregroundColor: COLORS.muted } };
const valueFormat = { textFormat: { foregroundColor: COLORS.text }, wrapStrategy: "WRAP" };
const statFormat = { textFormat: { bold: true, fontSize: 12, foregroundColor: COLORS.text }, horizontalAlignment: "LEFT" };
const headerFormat = {
  textFormat: { bold: true, foregroundColor: COLORS.white },
  backgroundColor: COLORS.brand,
  horizontalAlignment: "CENTER",
  wrapStrategy: "WRAP",
};

// ─── Tabs ──────────────────────────────────────────────────────────────────

const cleanTabName = (value) =>
  String(value || "")
    .replace(/[[\]:*?/\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TAB_NAME)
    .trim() || "Event";

const eventTabName = (event) =>
  cleanTabName(event.eventDate ? `${event.title} · ${moment(event.eventDate).tz(TIMEZONE).format("MMM D, YYYY")}` : event.title);

// Tab names are unique (case-insensitive); a second event with the same name gets " (2)"
function uniqueTabName(tabs, desired, ownSheetId) {
  const taken = new Set(tabs.filter((tab) => tab.sheetId !== ownSheetId).map((tab) => tab.title.toLowerCase()));
  let name = desired;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${desired} (${n})`;
  return name;
}

function newSheetId(tabs) {
  const used = new Set(tabs.map((tab) => tab.sheetId));
  let id;
  do id = 1 + Math.floor(Math.random() * 2000000000);
  while (used.has(id));
  return id;
}

// Finds the tab (by id), renaming it if needed, or plans a new one. Returns the requests that make it so.
// The id is chosen here, so creating the tab and filling it happen in one atomic batch.
function prepareTab(tabs, { sheetId, name, index, rowsNeeded = 0 }) {
  const existing = sheetId != null ? tabs.find((tab) => tab.sheetId === sheetId) : null;
  const title = uniqueTabName(tabs, name, existing ? existing.sheetId : null);

  if (existing) {
    const requests = [];
    if (existing.title !== title) {
      requests.push({ updateSheetProperties: { properties: { sheetId: existing.sheetId, title }, fields: "title" } });
    }
    if (existing.rowCount < rowsNeeded) {
      requests.push({ appendDimension: { sheetId: existing.sheetId, dimension: "ROWS", length: rowsNeeded - existing.rowCount + 200 } });
    }
    existing.title = title;
    return { ...existing, isNew: false, requests };
  }

  const tab = {
    sheetId: newSheetId(tabs),
    title,
    index: Math.min(index, tabs.length),
    rowCount: Math.max(DEFAULT_ROW_COUNT, rowsNeeded + 200),
  };
  tabs.push(tab);
  return {
    ...tab,
    isNew: true,
    requests: [
      {
        addSheet: {
          properties: { sheetId: tab.sheetId, title, index: tab.index, gridProperties: { rowCount: tab.rowCount, columnCount: 10 } },
        },
      },
    ],
  };
}

// One-time layout of a fresh tab: column widths, title row height, merged summary cells, filter on the table
function layoutRequests(sheetId, widths, { summary = true } = {}) {
  const range = (r0, r1, c0, c1) => ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const merge = (r0, r1, c0, c1) => ({ mergeCells: { range: range(r0, r1, c0, c1), mergeType: "MERGE_ALL" } });
  const requests = [
    ...widths.map((pixelSize, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize },
        fields: "pixelSize",
      },
    })),
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 44 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: HEADER_ROW, endIndex: HEADER_ROW + 1 },
        properties: { pixelSize: 36 },
        fields: "pixelSize",
      },
    },
    merge(0, 1, 0, COLUMN_COUNT),
    merge(1, 2, 0, COLUMN_COUNT),
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: HEADER_ROW, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT } } } },
  ];
  if (summary) {
    requests.push(merge(SUMMARY_ROW - 1, SUMMARY_ROW, 0, 3), merge(SUMMARY_ROW - 1, SUMMARY_ROW, 4, COLUMN_COUNT));
    for (let r = SUMMARY_ROW; r < SUMMARY_ROW + SUMMARY_ROWS; r++) requests.push(merge(r, r + 1, 1, 3), merge(r, r + 1, 5, COLUMN_COUNT));
  }
  return requests;
}

// Replaces columns A–G of the whole tab (anything below `rows` is cleared); columns H+ are left for manual notes
const writeAllRequest = (sheetId, rows) => ({
  updateCells: {
    range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT },
    rows: rows.map((values) => ({ values })),
    fields: "userEnteredValue,userEnteredFormat",
  },
});

const writeRowsRequest = (sheetId, rowIndex, rows) => ({
  updateCells: {
    start: { sheetId, rowIndex, columnIndex: 0 },
    rows: rows.map((values) => ({ values })),
    fields: "userEnteredValue,userEnteredFormat",
  },
});

// ─── RSVP list tabs (events + no active event) ─────────────────────────────

const titleRow = (title) => [cell(title, titleFormat), ...Array(COLUMN_COUNT - 1).fill(empty(titleFormat))];
const subtitleRow = () => [cell(syncedAt(), subtitleFormat), ...Array(COLUMN_COUNT - 1).fill(empty(subtitleFormat))];
const blankRow = () => Array(COLUMN_COUNT).fill(empty());

// Title, event details (left), live totals (right) and the table header. Totals are formulas over the table,
// so they stay right even if rows are edited by hand.
function buildListTop(title, details) {
  const totals = [
    ["Total RSVPs", formula(`=COUNTA(${dataRange("C")})`)],
    ["Expected Attendees", formula(`=SUM(${dataRange("E")})`)],
    ["Opted in to Updates", formula(`=COUNTIF(${dataRange("F")},"Yes")`)],
    ["Average Party Size", formula(`=IFERROR(ROUND(AVERAGE(${dataRange("E")}),1),0)`)],
    ["Latest RSVP", formula(`=IF(COUNT(${dataRange("G")})=0,"—",MAX(${dataRange("G")}))`), { numberFormat: DATE_TIME_FORMAT }],
  ];

  const rows = [
    titleRow(title),
    subtitleRow(),
    blankRow(),
    [
      cell("EVENT DETAILS", sectionFormat), empty(sectionFormat), empty(sectionFormat), empty(),
      cell("RSVP SUMMARY", sectionFormat), empty(sectionFormat), empty(sectionFormat),
    ],
  ];
  for (let i = 0; i < SUMMARY_ROWS; i++) {
    const [label, value] = details[i] || ["", ""];
    const [totalLabel, totalValue, totalFormat] = totals[i];
    rows.push([
      cell(label, labelFormat), cell(value, valueFormat), empty(valueFormat), empty(),
      cell(totalLabel, labelFormat), cell(totalValue, { ...statFormat, ...totalFormat }), empty(statFormat),
    ]);
  }
  rows.push(blankRow());
  rows.push(COLUMNS.map((name) => cell(name, headerFormat)));
  return rows;
}

function rsvpRow(rsvp, position) {
  const base = { backgroundColor: position % 2 ? COLORS.stripe : COLORS.white };
  const center = { ...base, horizontalAlignment: "CENTER" };
  return [
    cell(rsvp.firstName, base),
    cell(rsvp.lastName, base),
    cell(rsvp.email, base),
    cell(rsvp.cellNumber, base),
    cell(Number(rsvp.guests) || 1, center),
    cell(rsvp.promotionalUpdates ? "Yes" : "No", center),
    cell(toSerial(rsvp.submittedAt || new Date()), { ...base, numberFormat: DATE_TIME_FORMAT }),
  ];
}

const eventDetails = (event, status) => [
  ["Event Date", formatEventDate(event.eventDate)],
  ["Time", event.eventTime || "—"],
  ["Location", event.location || "—"],
  ["RSVPs Close", formatEndDate(event.endDate)],
  ["Status", status],
];

// Rebuilds an event's tab from the given RSVPs and returns the tab id
async function writeEventTab(tabs, event, rsvps, { status = longStatus(event), namePrefix = "" } = {}) {
  const rows = [...buildListTop(event.title, eventDetails(event, status)), ...rsvps.map(rsvpRow)];
  const tab = prepareTab(tabs, {
    sheetId: event.sheetTabId,
    name: cleanTabName(namePrefix + eventTabName(event)),
    index: 1, // newest events sit right after the Overview
    rowsNeeded: rows.length,
  });
  await batchUpdate([
    ...tab.requests,
    ...(tab.isNew ? layoutRequests(tab.sheetId, COLUMN_WIDTHS) : []),
    writeAllRequest(tab.sheetId, rows),
  ]);
  return tab.sheetId;
}

async function syncEventFromDb(eventId) {
  const event = await RsvpEvent.findById(eventId).lean();
  if (!event) return;
  const rsvps = await EventRsvp.find({ event: event._id }).sort({ submittedAt: 1 }).lean();
  const tabs = await getTabs();
  const sheetTabId = await writeEventTab(tabs, event, rsvps);
  if (event.sheetTabId !== sheetTabId) {
    await RsvpEvent.updateOne({ _id: event._id }, { sheetTabId }, { timestamps: false });
  }
}

// Adds or updates (by email) one row on the "No Active Event" tab
async function upsertNoEventRow(rsvp) {
  const tabs = await getTabs();
  const existing = tabs.find((tab) => tab.title.toLowerCase() === NO_EVENT_TAB.toLowerCase());
  let rowIndex = FIRST_DATA_ROW;

  if (existing) {
    const { data } = await withRetry(() =>
      sheetsApi().spreadsheets.values.get({
        spreadsheetId: spreadsheetId(),
        range: `${quoteTab(existing.title)}!${dataRange("C")}`,
        majorDimension: "COLUMNS",
      })
    );
    const emails = (data.values?.[0] || []).map((value) => String(value).trim().toLowerCase());
    const found = emails.indexOf(rsvp.email.toLowerCase());
    rowIndex = FIRST_DATA_ROW + (found >= 0 ? found : emails.length);
  }

  const tab = prepareTab(tabs, { sheetId: existing?.sheetId, name: NO_EVENT_TAB, index: tabs.length, rowsNeeded: rowIndex + 1 });
  const requests = [...tab.requests];
  if (tab.isNew) {
    const top = buildListTop("RSVPs — No Active Event", [
      ["About", "RSVPs submitted while no event was live on /rsvp"],
      ["Status", "Always open"],
    ]);
    requests.push(...layoutRequests(tab.sheetId, COLUMN_WIDTHS), writeRowsRequest(tab.sheetId, 0, top));
  } else {
    requests.push(writeRowsRequest(tab.sheetId, 1, [subtitleRow()]));
  }
  requests.push(writeRowsRequest(tab.sheetId, rowIndex, [rsvpRow(rsvp, rowIndex - FIRST_DATA_ROW)]));
  await batchUpdate(requests);
  return tab.isNew;
}

// ─── Overview tab ──────────────────────────────────────────────────────────

async function syncOverviewFromDb() {
  const [events, totalsRows] = await Promise.all([
    RsvpEvent.find().sort({ createdAt: -1 }).lean(),
    EventRsvp.aggregate([{ $group: { _id: "$event", rsvps: { $sum: 1 }, expectedAttendees: { $sum: "$guests" } } }]),
  ]);
  const totals = new Map(totalsRows.map((row) => [String(row._id), row]));
  const tabs = await getTabs();
  const tabIds = new Set(tabs.map((tab) => tab.sheetId));
  const noEventTab = tabs.find((tab) => tab.title.toLowerCase() === NO_EVENT_TAB.toLowerCase());
  const liveEvent = events.find((event) => event.isActive);

  const allRsvps = events.reduce((sum, event) => sum + (totals.get(String(event._id))?.rsvps || 0), 0);
  const allAttendees = events.reduce((sum, event) => sum + (totals.get(String(event._id))?.expectedAttendees || 0), 0);
  const noEventRef = (cellRef) => (noEventTab ? formula(`=${quoteTab(noEventTab.title)}!${cellRef}`) : 0);
  const link = (sheetId, label) =>
    sheetId != null && tabIds.has(sheetId) ? formula(`=HYPERLINK("#gid=${sheetId}","${quoteText(label)}")`) : label;

  const summary = [
    ["Events", events.length],
    ["Live Event", liveEvent ? link(liveEvent.sheetTabId, liveEvent.title) : "None — the RSVP page shows no open event"],
    ["RSVPs (all events)", allRsvps],
    ["Expected Attendees (all events)", allAttendees],
    ["RSVPs without an event", noEventRef(`F${SUMMARY_ROW + 1}`)],
  ];

  const rows = [
    titleRow("Harmony 4 All — RSVP Overview"),
    subtitleRow(),
    blankRow(),
    [cell("SUMMARY", sectionFormat), empty(sectionFormat), empty(sectionFormat), ...Array(COLUMN_COUNT - 3).fill(empty())],
    ...summary.map(([label, value]) => [
      cell(label, labelFormat),
      cell(value, statFormat),
      empty(statFormat),
      ...Array(COLUMN_COUNT - 3).fill(empty()),
    ]),
    blankRow(),
    OVERVIEW_COLUMNS.map((name) => cell(name, headerFormat)),
  ];

  events.forEach((event, i) => {
    const base = { backgroundColor: i % 2 ? COLORS.stripe : COLORS.white };
    const center = { ...base, horizontalAlignment: "CENTER" };
    const eventTotals = totals.get(String(event._id)) || { rsvps: 0, expectedAttendees: 0 };
    rows.push([
      cell(link(event.sheetTabId, event.title), { ...base, textFormat: { bold: event.isActive } }),
      cell(event.eventDate ? formatEventDate(event.eventDate) : "—", base),
      cell(event.endDate ? moment(event.endDate).tz(TIMEZONE).format("MMM D, YYYY") : "—", base),
      cell(shortStatus(event), { ...center, textFormat: { bold: event.isActive, foregroundColor: event.isActive ? hex("#15803D") : COLORS.text } }),
      cell(eventTotals.rsvps, center),
      cell(eventTotals.expectedAttendees, center),
      cell(moment(event.createdAt).tz(TIMEZONE).format("MMM D, YYYY"), base),
    ]);
  });

  if (noEventTab) {
    const base = { backgroundColor: events.length % 2 ? COLORS.stripe : COLORS.white };
    const center = { ...base, horizontalAlignment: "CENTER" };
    rows.push([
      cell(link(noEventTab.sheetId, "RSVPs with no live event"), { ...base, textFormat: { italic: true } }),
      cell("—", base),
      cell("—", base),
      cell("Always open", center),
      cell(noEventRef(`F${SUMMARY_ROW + 1}`), center),
      cell(noEventRef(`F${SUMMARY_ROW + 2}`), center),
      empty(base),
    ]);
  }

  const existing = tabs.find((tab) => tab.title.toLowerCase() === OVERVIEW_TAB.toLowerCase());
  const tab = prepareTab(tabs, { sheetId: existing?.sheetId, name: OVERVIEW_TAB, index: 0, rowsNeeded: rows.length });
  const requests = [...tab.requests];
  if (tab.isNew) {
    requests.push(...layoutRequests(tab.sheetId, OVERVIEW_WIDTHS, { summary: false }));
    // "SUMMARY" heading spans A:C; each summary value spans B:C
    for (let r = SUMMARY_ROW - 1; r < SUMMARY_ROW + SUMMARY_ROWS; r++) {
      requests.push({
        mergeCells: {
          range: { sheetId: tab.sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: r < SUMMARY_ROW ? 0 : 1, endColumnIndex: 3 },
          mergeType: "MERGE_ALL",
        },
      });
    }
    requests.push(...(await removeBlankStarterTab(tabs, tab.sheetId)));
  }
  requests.push(writeAllRequest(tab.sheetId, rows));
  await batchUpdate(requests);
}

// A brand-new spreadsheet comes with an empty "Sheet1"; drop it once our first tab exists
async function removeBlankStarterTab(tabs, keepSheetId) {
  const starter = tabs.find((tab) => /^sheet ?1$/i.test(tab.title) && tab.sheetId !== keepSheetId);
  if (!starter) return [];
  const { data } = await withRetry(() =>
    sheetsApi().spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: `${quoteTab(starter.title)}!A1:Z100` })
  );
  return data.values?.length ? [] : [{ deleteSheet: { sheetId: starter.sheetId } }];
}

// ─── Public API (all safe to call without awaiting; they never throw) ──────

// Rebuilds the event's tab (creating it on first use) and the Overview
function syncEvent(eventId) {
  const id = String(eventId);
  return inBackground(`event ${id}`, async () => {
    await enqueue(`event:${id}`, () => syncEventFromDb(id));
    await enqueue("overview", syncOverviewFromDb);
  });
}

function syncEvents(eventIds) {
  return Promise.all(eventIds.map((id) => syncEvent(id)));
}

// Keeps a deleted event's tab as an archive: renamed "Deleted – …" with the RSVPs it had
function archiveEvent(event, rsvps) {
  return inBackground(`archive ${event._id}`, async () => {
    await enqueue(`archive:${event._id}`, async () => {
      const tabs = await getTabs();
      if (event.sheetTabId == null || !tabs.some((tab) => tab.sheetId === event.sheetTabId)) return;
      await writeEventTab(tabs, event, rsvps, { status: "Deleted from the admin dashboard", namePrefix: DELETED_PREFIX });
    });
    await enqueue("overview", syncOverviewFromDb);
  });
}

// An RSVP submitted while no event was live
function recordNoEventRsvp(rsvp) {
  return inBackground("no active event", async () => {
    const createdTab = await enqueue(null, () => upsertNoEventRow(rsvp));
    if (createdTab) await enqueue("overview", syncOverviewFromDb);
  });
}

// Rebuilds every event tab and the Overview. Throws on failure (used by the admin "sync" button and the daily job).
async function syncAll() {
  if (!isEnabled()) throw new Error("Google Sheets is not configured");
  const events = await RsvpEvent.find().sort({ createdAt: 1 }).select("_id").lean();
  for (const event of events) await enqueue(`event:${event._id}`, () => syncEventFromDb(event._id));
  await enqueue("overview", syncOverviewFromDb);
  return { events: events.length };
}

// Nightly refresh so statuses ("Ended") and the Overview stay current even on days with no RSVPs
function scheduleDailySync() {
  if (!isEnabled()) return;
  cron.schedule(
    "10 0 * * *",
    () => syncAll().catch((error) => console.error("Daily Google Sheets RSVP sync failed:", error.message)),
    { timezone: TIMEZONE }
  );
}

module.exports = {
  isEnabled,
  getSpreadsheetUrl,
  syncEvent,
  syncEvents,
  archiveEvent,
  recordNoEventRsvp,
  syncAll,
  scheduleDailySync,
};
