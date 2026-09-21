/**
 * Generates the Cornelia T. Bailey Foundation grant thank-you letter on H4A letterhead.
 *
 * Usage: node scripts/generateGrantThankYouLetter.js
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'pdf', 'grant_thank_you_letter.html');
const OUTPUT_DIR = path.join(ROOT, 'generated-receipts');
const PDF_PATH = path.join(
  OUTPUT_DIR,
  'H4A_Thank_You_Letter_CTB_Foundation_Grant_1234-001.pdf'
);

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
          top: '0.65in',
          right: '0.75in',
          bottom: '0.7in',
          left: '0.75in',
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
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Prefer html-pdf so remote letterhead images (logo, watermark, signature)
  // load the same way as donation receipts.
  try {
    console.log('Generating PDF with html-pdf (same pipeline as donation receipts)...');
    await printWithHtmlPdf(html, PDF_PATH);
  } catch (htmlPdfError) {
    const browser = findBrowser();
    if (!browser) throw htmlPdfError;
    console.log('html-pdf failed; falling back to', browser);
    console.error(htmlPdfError.message);
    await printWithBrowser(browser, HTML_PATH, PDF_PATH);
  }

  const stats = fs.statSync(PDF_PATH);
  console.log('Wrote PDF:', PDF_PATH);
  console.log('Size:', Math.round(stats.size / 1024), 'KB');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
