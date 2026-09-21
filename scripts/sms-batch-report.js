const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const FONT_DIR = path.join(__dirname, '..', 'pdf', 'fonts', 'geist');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fontDataUri(fileName) {
  const filePath = path.join(FONT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Geist font missing: ${filePath}`);
  }
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:font/woff2;base64,${base64}`;
}

function buildGeistFontFaceCss() {
  // Same typeface family as frontend (geist/font/sans + geist/font/mono)
  return `
@font-face {
  font-family: "Geist";
  src: url("${fontDataUri('Geist-Regular.woff2')}") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Geist";
  src: url("${fontDataUri('Geist-Medium.woff2')}") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Geist";
  src: url("${fontDataUri('Geist-SemiBold.woff2')}") format("woff2");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Geist";
  src: url("${fontDataUri('Geist-Bold.woff2')}") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Geist Mono";
  src: url("${fontDataUri('GeistMono-Regular.woff2')}") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Geist Mono";
  src: url("${fontDataUri('GeistMono-Medium.woff2')}") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current);

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? '';
    });
    return row;
  });
}

function loadBatchData(runDir) {
  const summaryPath = path.join(runDir, 'summary.json');
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`summary.json not found in ${runDir}`);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const sentRows = parseCsv(path.join(runDir, 'sent.csv'));
  const failedRows = parseCsv(path.join(runDir, 'failed.csv'));

  const message = (() => {
    const runLogPath = path.join(runDir, 'run.log');
    if (!fs.existsSync(runLogPath)) return '';
    const text = fs.readFileSync(runLogPath, 'utf8');
    const match = text.match(/Message:\r?\n---\r?\n([\s\S]*?)\r?\n---/);
    return match ? match[1].trim() : '';
  })();

  return { summary, sentRows, failedRows, message, summaryPath };
}

function chunkRows(items, columns) {
  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

function buildReportHtml({ runDir, summary, sentRows, failedRows, message }) {
  const sentItems =
    sentRows.length > 0
      ? sentRows.map((row) => ({
          phone: row.phone,
          sid: row.sid || '',
          status: row.status || '',
          batch: row.batch || '',
        }))
      : (summary.sentPhones || []).map((phone) => ({
          phone,
          sid: '',
          status: '',
          batch: '',
        }));

  const failedItems =
    failedRows.length > 0
      ? failedRows.map((row) => ({
          phone: row.phone,
          error: row.error,
          batch: row.batch || '',
        }))
      : (summary.failedPhones || []).map((item) => ({
          phone: item.phone,
          error: item.error,
          batch: '',
        }));

  const sentCount = summary.results?.sent ?? sentItems.length;
  const failedCount = summary.results?.failed ?? failedItems.length;
  const totalAttempted = sentCount + failedCount;
  const successRate =
    totalAttempted === 0
      ? '0.0'
      : ((sentCount / totalAttempted) * 100).toFixed(1);

  const runLabel = path.basename(runDir);
  const dateLabel = path.basename(path.dirname(runDir));

  // Compact 3-column phone table for long sent lists (PhantomJS-friendly)
  const sentTableRowsHtml =
    sentItems.length === 0
      ? `<tr><td colspan="6" class="empty">No sent numbers recorded.</td></tr>`
      : chunkRows(sentItems, 3)
          .map((group, rowIndex) => {
            const cells = [];
            for (let col = 0; col < 3; col += 1) {
              const item = group[col];
              const number = rowIndex * 3 + col + 1;
              if (item) {
                cells.push(
                  `<td class="num">${number}</td><td class="mono phone">${escapeHtml(item.phone)}</td>`
                );
              } else {
                cells.push('<td class="num"></td><td class="phone"></td>');
              }
            }
            return `<tr>${cells.join('')}</tr>`;
          })
          .join('');

  const failedRowsHtml =
    failedItems.length === 0
      ? `<tr><td colspan="4" class="empty">No failed sends.</td></tr>`
      : failedItems
          .map(
            (item, index) => `
      <tr>
        <td class="num">${index + 1}</td>
        <td class="mono">${escapeHtml(item.phone)}</td>
        <td>${escapeHtml(item.error)}</td>
        <td class="num">${escapeHtml(item.batch || '—')}</td>
      </tr>`
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SMS Batch Report — ${escapeHtml(runLabel)}</title>
  <style>
    ${buildGeistFontFaceCss()}
    * { box-sizing: border-box; }
    body {
      font-family: "Geist", Arial, Helvetica, sans-serif;
      color: #000000;
      margin: 0;
      padding: 24px 28px;
      font-size: 11px;
      line-height: 1.4;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .brand {
      font-family: "Geist", Arial, Helvetica, sans-serif;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #000000;
      margin: 0 0 4px;
      font-weight: 700;
    }
    h1 {
      font-family: "Geist", Arial, Helvetica, sans-serif;
      font-size: 22px;
      margin: 0 0 2px;
      color: #000000;
      font-weight: 700;
    }
    .subtitle {
      font-family: "Geist", Arial, Helvetica, sans-serif;
      color: #000000;
      margin: 0 0 16px;
      font-size: 11px;
      font-weight: 400;
    }
    h2 {
      font-family: "Geist", Arial, Helvetica, sans-serif;
      font-size: 13px;
      margin: 20px 0 8px;
      color: #000000;
      border-bottom: 1px solid #000000;
      padding-bottom: 4px;
      font-weight: 700;
    }
    /* Table layout so PhantomJS/html-pdf keeps cards on one row */
    table.stats {
      width: 100%;
      border-collapse: separate;
      border-spacing: 8px 0;
      margin: 0 0 8px;
      table-layout: fixed;
    }
    table.stats td.stat {
      width: 25%;
      border: 1px solid #000000;
      padding: 10px 12px;
      background: #ffffff;
      vertical-align: top;
    }
    table.stats .label {
      display: block;
      font-family: "Geist", Arial, Helvetica, sans-serif;
      color: #000000;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      margin-bottom: 4px;
    }
    table.stats .value {
      display: block;
      font-family: "Geist", Arial, Helvetica, sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #000000;
      line-height: 1.1;
    }
    .message {
      white-space: pre-wrap;
      background: #ffffff;
      border: 1px solid #000000;
      padding: 10px 12px;
      font-family: "Geist Mono", "Courier New", Courier, monospace;
      font-size: 10.5px;
      color: #000000;
      margin: 0;
    }
    table.detail {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    table.detail th,
    table.detail td {
      border: 1px solid #000000;
      padding: 5px 7px;
      text-align: left;
      vertical-align: top;
      color: #000000;
      font-family: "Geist", Arial, Helvetica, sans-serif;
    }
    table.detail th {
      background: #eeeeee;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table.detail td.empty {
      text-align: center;
      font-style: italic;
    }
    table.detail td.num {
      width: 36px;
      text-align: right;
      color: #000000;
      white-space: nowrap;
      font-family: "Geist Mono", "Courier New", Courier, monospace;
      font-size: 10px;
    }
    table.detail td.phone {
      white-space: nowrap;
    }
    table.sent-grid td.num {
      width: 34px;
    }
    table.sent-grid td.phone {
      width: auto;
    }
    .mono {
      font-family: "Geist Mono", "Courier New", Courier, monospace;
      font-size: 10px;
    }
    .footer {
      margin-top: 22px;
      color: #000000;
      font-size: 9px;
      border-top: 1px solid #000000;
      padding-top: 8px;
      font-family: "Geist", Arial, Helvetica, sans-serif;
    }
  </style>
</head>
<body>
  <div class="brand">Harmony 4 All</div>
  <h1>SMS Batch Send Report</h1>
  <div class="subtitle">${escapeHtml(dateLabel)} / ${escapeHtml(runLabel)}</div>

  <table class="stats" cellspacing="8" cellpadding="0">
    <tr>
      <td class="stat">
        <span class="label">Sent</span>
        <span class="value">${sentCount}</span>
      </td>
      <td class="stat">
        <span class="label">Failed</span>
        <span class="value">${failedCount}</span>
      </td>
      <td class="stat">
        <span class="label">Success rate</span>
        <span class="value">${successRate}%</span>
      </td>
      <td class="stat">
        <span class="label">Duration</span>
        <span class="value">${escapeHtml(formatDuration(summary.durationMs))}</span>
      </td>
    </tr>
  </table>

  <h2>SMS message</h2>
  <div class="message">${escapeHtml(message || '(message not found in run.log)')}</div>

  <h2>Sent numbers (${sentCount})</h2>
  <table class="detail sent-grid">
    <thead>
      <tr>
        <th>#</th><th>Phone</th>
        <th>#</th><th>Phone</th>
        <th>#</th><th>Phone</th>
      </tr>
    </thead>
    <tbody>
      ${sentTableRowsHtml}
    </tbody>
  </table>

  <h2>Failed numbers (${failedCount})</h2>
  <table class="detail">
    <thead>
      <tr>
        <th>#</th>
        <th>Phone</th>
        <th>Error</th>
        <th>Batch</th>
      </tr>
    </thead>
    <tbody>
      ${failedRowsHtml}
    </tbody>
  </table>

  <div class="footer">
    Generated ${escapeHtml(formatDateTime(new Date().toISOString()))} · Source files: summary.json, sent.csv, failed.csv, run.log
  </div>
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
    execFile(browser, args, { timeout: 180000 }, (error) => {
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
          bottom: '0.5in',
          left: '0.5in',
        },
        type: 'pdf',
        quality: 'high',
        timeout: 180000,
      })
      .toFile(pdfFile, (error) => {
        if (error) reject(error);
        else resolve();
      });
  });
}

async function generateSmsBatchPdfReport(runDir, options = {}) {
  const absoluteRunDir = path.resolve(runDir);
  if (!fs.existsSync(absoluteRunDir)) {
    throw new Error(`Run folder not found: ${absoluteRunDir}`);
  }

  const data = loadBatchData(absoluteRunDir);
  const html = buildReportHtml({
    runDir: absoluteRunDir,
    summary: data.summary,
    sentRows: data.sentRows,
    failedRows: data.failedRows,
    message: data.message,
  });

  const htmlPath = path.join(absoluteRunDir, 'report.html');
  const pdfPath = path.join(absoluteRunDir, 'report.pdf');

  fs.writeFileSync(htmlPath, html, 'utf8');

  let method = 'browser';
  const browser = findBrowser();

  try {
    if (browser) {
      await printWithBrowser(browser, htmlPath, pdfPath);
      method = path.basename(browser);
    } else {
      method = 'html-pdf';
      await printWithHtmlPdf(html, pdfPath);
    }
  } catch (primaryError) {
    if (browser && method !== 'html-pdf') {
      if (!options.silent) {
        console.warn(`Browser PDF failed (${primaryError.message}); falling back to html-pdf`);
      }
      method = 'html-pdf';
      await printWithHtmlPdf(html, pdfPath);
    } else if (browser) {
      if (!options.silent) {
        console.warn(`html-pdf failed (${primaryError.message}); falling back to ${path.basename(browser)}`);
      }
      method = path.basename(browser);
      await printWithBrowser(browser, htmlPath, pdfPath);
    } else {
      throw primaryError;
    }
  }

  // Keep report path on summary.json when regenerating
  try {
    const summary = { ...data.summary };
    summary.files = {
      ...(summary.files || {}),
      reportHtml: htmlPath,
      reportPdf: pdfPath,
    };
    fs.writeFileSync(data.summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  } catch (_) {
    // non-fatal
  }

  return { htmlPath, pdfPath, method };
}

module.exports = {
  generateSmsBatchPdfReport,
  loadBatchData,
  buildReportHtml,
};

if (require.main === module) {
  const target =
    process.argv[2] ||
    path.join(__dirname, '..', 'sms-logs', '2026-09-16', 'batch-115940');

  generateSmsBatchPdfReport(target)
    .then(({ pdfPath, htmlPath, method }) => {
      const stats = fs.statSync(pdfPath);
      console.log(`PDF report created via ${method}`);
      console.log(`HTML: ${htmlPath}`);
      console.log(`PDF:  ${pdfPath}`);
      console.log(`Size: ${Math.round(stats.size / 1024)} KB`);
    })
    .catch((error) => {
      console.error('Failed to generate SMS batch PDF report:', error.message);
      process.exit(1);
    });
}
