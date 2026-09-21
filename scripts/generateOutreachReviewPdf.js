/**
 * Builds a shareable review PDF of the 111-org NYC outreach list.
 *
 * Usage: node scripts/generateOutreachReviewPdf.js
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'Joshua_Quddus_NYC_Outreach_All_111.csv');
const HTML_PATH = path.join(ROOT, 'pdf', 'joshua_quddus_outreach_review.html');
const PDF_PATH = path.join(ROOT, 'Joshua_Quddus_NYC_Outreach_Review_Packet.pdf');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows[0];
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    return record;
  });
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusKey(action) {
  if (action.startsWith('Send')) return 'send';
  if (action.startsWith('Pick')) return 'pick';
  if (action.startsWith('Confirm')) return 'confirm';
  return 'research';
}

function shortAction(action) {
  return action
    .replace('Send Version ', 'Send ')
    .replace('Pick 1 email then send Version ', 'Pick 1 · ')
    .replace('Confirm buyer then send Version ', 'Confirm · ')
    .replace('Use official route then Version ', 'Route · ');
}

function emailDisplay(row) {
  if (row.Email === 'No public email') {
    return `<span class="muted">No public email</span><br><span class="route">${esc(row['Official route'])}</span>`;
  }
  const parts = row.Email.split(' OR ').map((part) => esc(part.trim()));
  if (parts.length > 1) {
    return `${parts[0]}<br><span class="or">or</span> ${parts[1]}`;
  }
  return parts[0];
}

function orgCell(row) {
  const extra = [];
  if (row['Named contact']) extra.push(esc(row['Named contact']));
  if (row.Phone) extra.push(esc(row.Phone));
  const meta = extra.length ? `<div class="meta">${extra.join(' · ')}</div>` : '';
  return `<strong>${esc(row.Organization)}</strong>${meta}`;
}

function directoryTable(rows, caption) {
  const body = rows
    .map((row) => {
      const status = statusKey(row.Action);
      return `<tr class="${status}">
        <td class="num">${esc(row['#'])}</td>
        <td class="org">${orgCell(row)}</td>
        <td class="tier">T${esc(row.Tier)}</td>
        <td class="tpl">${esc(row.Template)}</td>
        <td class="email">${emailDisplay(row)}</td>
        <td class="act">${esc(shortAction(row.Action))}</td>
        <td class="notes"></td>
      </tr>`;
    })
    .join('\n');

  return `<table class="dir">
    <caption>${esc(caption)}</caption>
    <thead>
      <tr>
        <th class="num">#</th>
        <th class="org">Organization</th>
        <th class="tier">Tier</th>
        <th class="tpl">Tpl</th>
        <th class="email">Email / official route</th>
        <th class="act">Action</th>
        <th class="notes">Reviewer notes</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function buildHtml(records) {
  const t1 = records.filter((row) => row.Tier === '1');
  const t2 = records.filter((row) => row.Tier === '2');
  const t3 = records.filter((row) => row.Tier === '3');
  const publicCount = records.filter((row) => row.Email !== 'No public email').length;
  const sendCount = records.filter((row) => row.Action.startsWith('Send')).length;
  const confirmCount = records.filter((row) =>
    row.Action.startsWith('Confirm') || row.Action.startsWith('Pick'),
  ).length;
  const researchCount = records.filter((row) => row.Action.startsWith('Use official')).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Joshua Quddus Quartet — NYC Outreach Review Packet</title>
<style>
  @page {
    size: Letter;
    margin: 0.55in 0.5in 0.75in 0.5in;
    @bottom-center {
      content: "Joshua Quddus Music  ·  Internal review draft  ·  Page " counter(page);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8px;
      letter-spacing: 0.4px;
      color: #6a635a;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #1b1916;
    background: #fff;
    font-size: 10.5px;
    line-height: 1.45;
    letter-spacing: 0.2px;
    margin: 0;
  }
  h1, h2, h3, .serif {
    font-family: Georgia, "Times New Roman", serif;
    letter-spacing: 0;
  }
  h1 {
    font-size: 28px;
    font-weight: bold;
    margin: 8px 0 6px;
    line-height: 1.15;
  }
  h2 {
    font-size: 16px;
    margin: 22px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid #1b1916;
    page-break-after: avoid;
  }
  h3 {
    font-size: 13px;
    margin: 16px 0 6px;
    page-break-after: avoid;
  }
  p { margin: 0 0 8px; }
  .kicker {
    font-size: 11px;
    letter-spacing: 2.4px;
    text-transform: uppercase;
    font-weight: bold;
  }
  .subtitle {
    font-style: italic;
    font-size: 13px;
    color: #4a453e;
    margin-bottom: 14px;
  }
  .rule {
    border: 0;
    border-top: 3px solid #1b1916;
    margin: 0 0 14px;
  }
  .cover-meta {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 16px;
  }
  .cover-meta td {
    vertical-align: top;
    padding: 0 16px 0 0;
    font-size: 11px;
  }
  .label { font-weight: bold; display: block; font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; color: #6a635a; }
  .stats {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px;
  }
  .stats td {
    width: 16.66%;
    background: #f4f0e8;
    border: 1px solid #e4ddd1;
    text-align: center;
    padding: 10px 6px 8px;
  }
  .stats .n {
    font-family: Georgia, serif;
    font-size: 22px;
    font-weight: bold;
    display: block;
    line-height: 1.1;
  }
  .stats .l { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #5b554c; }
  .box {
    background: #f4f0e8;
    border: 1px solid #e4ddd1;
    border-left: 4px solid #8b6b3d;
    padding: 11px 13px;
    margin: 10px 0 14px;
    page-break-inside: avoid;
  }
  .box strong { display: block; margin-bottom: 4px; font-size: 12px; }
  ul { margin: 4px 0 8px 18px; padding: 0; }
  li { margin: 0 0 4px; }
  .two {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
  }
  .two td {
    width: 50%;
    vertical-align: top;
    padding: 0 14px 0 0;
  }
  .mark-guide td {
    font-size: 10px;
    padding: 4px 10px 4px 0;
    vertical-align: top;
  }
  .swatch {
    display: inline-block;
    width: 9px;
    height: 9px;
    margin-right: 5px;
    vertical-align: middle;
  }
  .swatch.send { background: #1f4d38; }
  .swatch.confirm { background: #7a4e12; }
  .swatch.pick { background: #243f66; }
  .swatch.research { background: #7a7a7a; }
  table.tpl, table.dir, table.form {
    width: 100%;
    border-collapse: collapse;
  }
  table.tpl th, table.tpl td,
  table.dir th, table.dir td,
  table.form th, table.form td {
    border: 1px solid #d9d2c6;
    padding: 6px 7px;
    vertical-align: top;
    text-align: left;
  }
  table.tpl th, table.dir th {
    background: #1b1916;
    color: #fff;
    font-size: 8.5px;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    font-weight: bold;
  }
  table.tpl td { font-size: 10px; }
  table.dir { font-size: 9px; margin: 8px 0 18px; }
  table.dir caption {
    caption-side: top;
    text-align: left;
    font-family: Georgia, serif;
    font-size: 13px;
    font-weight: bold;
    padding: 10px 0 6px;
  }
  table.dir thead { display: table-header-group; }
  table.dir tbody tr { page-break-inside: avoid; }
  table.dir .num { width: 22px; text-align: right; color: #6a635a; }
  table.dir .tier, table.dir .tpl { width: 28px; text-align: center; font-weight: bold; white-space: nowrap; }
  table.dir .act { width: 78px; white-space: nowrap; }
  table.dir .notes { width: 108px; background: #fbfaf7; }
  table.dir .org { width: 150px; }
  table.dir .meta { font-size: 8px; color: #5b554c; margin-top: 2px; font-weight: normal; }
  table.dir .muted { color: #6a635a; font-style: italic; }
  table.dir .route { font-size: 8px; color: #5b554c; }
  table.dir .or { font-size: 8px; color: #8b6b3d; font-style: italic; }
  tr.send td:first-child { border-left: 3px solid #1f4d38; }
  tr.confirm td:first-child { border-left: 3px solid #7a4e12; }
  tr.pick td:first-child { border-left: 3px solid #243f66; }
  tr.research td:first-child { border-left: 3px solid #7a7a7a; }
  tr.send td.act { color: #1f4d38; font-weight: bold; }
  tr.confirm td.act { color: #7a4e12; font-weight: bold; }
  tr.pick td.act { color: #243f66; font-weight: bold; }
  tr.research td.act { color: #5c5c5c; }
  .steps td {
    width: 25%;
    vertical-align: top;
    background: #f4f0e8;
    border: 1px solid #e4ddd1;
    padding: 10px 11px;
  }
  .steps .n {
    font-family: Georgia, serif;
    font-size: 18px;
    font-weight: bold;
    display: block;
    margin-bottom: 4px;
  }
  .line {
    border-bottom: 1px solid #cfc6b8;
    height: 22px;
  }
  .lines { margin-top: 4px; }
  .page-break { page-break-before: always; }
  .footer-note {
    margin-top: 16px;
    font-size: 9px;
    color: #6a635a;
  }
  .stamp {
    display: inline-block;
    border: 1px solid #1b1916;
    padding: 2px 8px;
    font-size: 9px;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    font-weight: bold;
    margin-bottom: 10px;
  }
</style>
</head>
<body>

<div class="stamp">Internal review draft</div>
<div class="kicker">Joshua Quddus Music</div>
<h1>NYC Booking Outreach<br>Review Packet</h1>
<p class="subtitle">111-organization list for corporate and private-event booking, prepared so a reviewer can mark comments, corrections, and suggestions before any mail is sent.</p>
<hr class="rule">

<table class="cover-meta">
  <tr>
    <td><span class="label">Artist</span>Joshua Quddus Quartet</td>
    <td><span class="label">Review date</span>August 19, 2026</td>
    <td><span class="label">Contacts verified</span>August 16, 2026</td>
    <td><span class="label">Return comments to</span>info@joshuaquddus.com</td>
  </tr>
</table>

<table class="stats">
  <tr>
    <td><span class="n">111</span><span class="l">Organizations</span></td>
    <td><span class="n">26</span><span class="l">Tier 1 first</span></td>
    <td><span class="n">61</span><span class="l">Tier 2 batch</span></td>
    <td><span class="n">24</span><span class="l">Tier 3 nurture</span></td>
    <td><span class="n">${publicCount}</span><span class="l">Public emails</span></td>
    <td><span class="n">${researchCount}</span><span class="l">Find a route</span></td>
  </tr>
</table>

<div class="box">
  <strong>Why this packet exists</strong>
  This is not a finished mail-merge. It is a working directory for a second set of eyes. Please mark wrong buyers, better contacts, template mismatches, orgs to drop or add, and any warm introductions we should use instead of a cold email. Do not send from this list until the review notes on the last page are complete.
</div>

<h2>How to mark this document</h2>
<table class="mark-guide">
  <tr>
    <td width="25%"><span class="swatch send"></span><strong>Send</strong> — events-specific or named buyer. Ready after personalization.</td>
    <td width="25%"><span class="swatch pick"></span><strong>Pick 1</strong> — two valid contacts. Choose one recipient. Never To/CC both.</td>
    <td width="25%"><span class="swatch confirm"></span><strong>Confirm</strong> — public email may not be the events buyer. Check the official page first.</td>
    <td width="25%"><span class="swatch research"></span><strong>Find route</strong> — no public email. Use the form, phone, or marketplace path listed.</td>
  </tr>
</table>
<p>In the <strong>Reviewer notes</strong> column, please write one of: <strong>OK</strong> · <strong>Wrong buyer</strong> · <strong>New email: ___</strong> · <strong>Change template</strong> · <strong>Move tier</strong> · <strong>Drop</strong> · <strong>Warm intro</strong>. Add a short reason if you change anything.</p>

<h2>What we need from you</h2>
<table class="two">
  <tr>
    <td>
      <ul>
        <li>Are any public inboxes clearly a client RFP, space-rental, or artistic-booking desk rather than an entertainment buyer?</li>
        <li>Should any Tier 1 names wait, or any Tier 3 names move up because of a relationship?</li>
        <li>Is Version C vs D correct when a cultural venue is reached through a caterer (Great Performances, Union Square Events, Restaurant Associates)?</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Missing NYC agencies, planners, hotels, or cultural rooms worth adding?</li>
        <li>Anyone on this list where we already have a personal relationship or should ask for an introduction instead of emailing?</li>
        <li>Any subject line or ask that will land wrong for a specific buyer type?</li>
      </ul>
    </td>
  </tr>
</table>

<h2>How every email is sent</h2>
<p>Do not put all 111 contacts in To, CC, or one BCC blast. Use a personalized mail merge with <strong>one visible recipient per message</strong>. Send from <strong>info@joshuaquddus.com</strong>. Attach <strong>Joshua_Quddus_EPK.pdf</strong> and one 60–90 second event-reel link. Replace the physical postal address in the footer. Include: <em>To opt out of future booking emails, reply 'unsubscribe.'</em></p>

<table class="two steps" style="margin-top:10px;">
  <tr>
    <td><span class="n">1</span><strong>Package</strong><br>EPK renamed, reel link works, file size is reasonable.</td>
    <td><span class="n">2</span><strong>Match the buyer</strong><br>Pick Version A, B, C, or D from buyer type — not from tier.</td>
    <td><span class="n">3</span><strong>Personalize</strong><br>Replace recipient, organization, and one fit sentence. No leftover brackets.</td>
    <td><span class="n">4</span><strong>Follow up</strong><br>Reply in-thread after 6 days with new value, then around day 16. Stop after opt-out, no, or two unanswered useful follow-ups.</td>
  </tr>
</table>
<p>Tier is only send order: Tier 1 first with full personalization, Tier 2 in researched batches after buyer confirmation, Tier 3 after stronger proof, a warm introduction, or a highly specific program fit. ${sendCount} rows are marked Send. ${confirmCount} still need buyer confirmation or a one-person choice. ${researchCount} have no public email.</p>
<p><strong>Shared inbox:</strong> <em>celebratefood@greatperformances.com</em> is listed for Great Performances (#10), NYPL Schwarzman (#34), and Asia Society (#80). Send it once to Great Performances. Asia Society still needs a separate programming contact for Version D.</p>

<h2>Which template to use</h2>
<p>Wrong template is the most common miss. A hotel should receive a vendor inquiry, not an artist submission.</p>
<table class="tpl">
  <thead>
    <tr>
      <th style="width:42px;">Ver.</th>
      <th>Use for</th>
      <th>Subject line</th>
      <th>The ask</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>A</strong></td>
      <td>Entertainment agencies and marketplaces (Star Talent, ECE, Élan, Hank Lane, Scarlett, Jarrell, On The Move)</td>
      <td>Artist Submission: Joshua Quddus Quartet - NYC Jazz for Corporate &amp; Private Events</td>
      <td>Artist roster / small-ensemble database</td>
    </tr>
    <tr>
      <td><strong>B</strong></td>
      <td>Corporate planners and experiential agencies (FIRST, Tinsel, Rafanelli, Jack Morton, LDJ, Eventique, EMRG, 23 Layers)</td>
      <td>NYC Live Jazz Partner for Receptions, Galas &amp; Brand Experiences</td>
      <td>Who manages NYC entertainment suppliers? Follow vendor review.</td>
    </tr>
    <tr>
      <td><strong>C</strong></td>
      <td>Hotels, venues, caterers, hospitality (Convene, Great Performances, Union Square Events, Pier Sixty, ASPIRE)</td>
      <td>Preferred Entertainment Vendor Inquiry - Joshua Quddus Quartet</td>
      <td>Preferred-entertainment list — not a space-rental request</td>
    </tr>
    <tr>
      <td><strong>D</strong></td>
      <td>Cultural institutions (museums, gardens, libraries, performing-arts orgs). Keep rental and curatorial asks separate.</td>
      <td>Joshua Quddus Quartet - Contemporary Jazz in Conversation with Carnatic Music</td>
      <td>Reception music and/or a 30–45 minute cultural program</td>
    </tr>
    <tr>
      <td><strong>Master</strong></td>
      <td>Only when A–D is a worse fit</td>
      <td>NYC Live Jazz for Corporate &amp; Private Events | Joshua Quddus Quartet</td>
      <td>Upcoming event, preferred list, or artist roster</td>
    </tr>
  </tbody>
</table>

<div class="page-break"></div>
<h2>Full directory — all 111</h2>
<p>Source list order. Left-edge color matches the action. Write directly in the notes column. Recheck the official page before any send. A listed public email is not mailbox-verified and is not proof the organization is accepting new artists.</p>

${directoryTable(t1, 'Tier 1 — 26 organizations — send first, full personalization')}
${directoryTable(t2, 'Tier 2 — 61 organizations — confirm the buyer, then work in researched batches')}
${directoryTable(t3, 'Tier 3 — 24 organizations — nurture, warm introduction, or highly specific program fit')}

<p class="footer-note">
  Joshua Quddus Music · info@joshuaquddus.com · (718) 316-7587 · www.joshuaquddus.com<br>
  Contacts verified August 16, 2026 · Review packet prepared August 19, 2026 · Internal use only · Do not blast this list · Honor opt-outs · Recheck each official page before sending.
</p>

</body>
</html>`;
}

function findBrowser() {
  const candidates = [
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  return candidates.find((file) => fs.existsSync(file)) || null;
}

function printWithBrowser(browser, htmlFile, pdfFile) {
  return new Promise((resolve, reject) => {
    const fileUrl = 'file:///' + htmlFile.replace(/\\/g, '/');
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      `--print-to-pdf=${pdfFile}`,
      fileUrl,
    ];
    execFile(browser, args, { timeout: 120000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function printWithHtmlPdf(html, pdfFile) {
  const pdf = require('html-pdf');
  return new Promise((resolve, reject) => {
    pdf
      .create(html, {
        format: 'Letter',
        orientation: 'portrait',
        border: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.65in',
          left: '0.5in',
        },
        footer: {
          height: '0.4in',
          contents: {
            default:
              '<div style="font-family:Arial,sans-serif;font-size:8px;color:#6a635a;text-align:center;letter-spacing:0.2px;">Joshua Quddus Music · Internal review draft · Page {{page}} of {{pages}} · info@joshuaquddus.com</div>',
          },
        },
        type: 'pdf',
        quality: 'high',
        timeout: 120000,
      })
      .toFile(pdfFile, (error) => {
        if (error) reject(error);
        else resolve();
      });
  });
}

async function main() {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parseCsv(csvText);
  if (records.length !== 111) {
    throw new Error(`Expected 111 rows, got ${records.length}`);
  }

  const html = buildHtml(records);
  fs.mkdirSync(path.dirname(HTML_PATH), { recursive: true });
  fs.writeFileSync(HTML_PATH, html, 'utf8');
  console.log('Wrote HTML:', HTML_PATH);

  const browser = findBrowser();
  if (browser) {
    console.log('Printing with', browser);
    await printWithBrowser(browser, HTML_PATH, PDF_PATH);
  } else {
    console.log('No Edge/Chrome found; falling back to html-pdf');
    await printWithHtmlPdf(html, PDF_PATH);
  }

  const stats = fs.statSync(PDF_PATH);
  console.log('Wrote PDF:', PDF_PATH);
  console.log('Size:', Math.round(stats.size / 1024), 'KB');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
