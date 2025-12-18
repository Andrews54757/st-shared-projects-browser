const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE_FILE = 'share-projects.html';
const OUTPUT_DIR = 'litematic-files';
const MAX_REDIRECTS = 5;

function extractUrls(html) {
  const urls = new Set();
  // Match href='...litematic...' or href="...litematic..." (literal dot, case-insensitive).
  const regex = /href=["']([^"']*?\.litematic[^"']*)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.add(decodeHtml(match[1]));
  }
  return Array.from(urls);
}

function decodeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resolveFilename(url, existing) {
  const urlObj = new URL(url);
  const base = path.basename(urlObj.pathname) || 'file.litematic';
  const extIndex = base.lastIndexOf('.');
  const stem = extIndex === -1 ? base : base.slice(0, extIndex);
  const ext = extIndex === -1 ? '' : base.slice(extIndex);
  // Use Discord snowflake (path segment before filename) to avoid collisions.
  const parts = urlObj.pathname.split('/').filter(Boolean);
  const snowflake = parts.length >= 1 ? parts[parts.length - 2] : 'unknown';
  let name = `${stem}-${snowflake}${ext}`;
  let i = 1;
  while (existing.has(name)) {
    name = `${stem}-${i}${ext}`;
    i += 1;
  }
  existing.add(name);
  return name;
}

function download(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectCount >= MAX_REDIRECTS) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          const next = new URL(res.headers.location, url).href;
          res.resume();
          download(next, dest, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
        file.on('error', (err) => reject(err));
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('Reading HTML export...');
  const html = fs.readFileSync(SOURCE_FILE, 'utf8');
  const urls = extractUrls(html);

  if (urls.length === 0) {
    console.log('No .litematic URLs found.');
    return;
  }

  console.log(`Found ${urls.length} unique .litematic links. Starting downloads...`);

  ensureDir(OUTPUT_DIR);
  const usedNames = new Set();

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const filename = resolveFilename(url, usedNames);
    const dest = path.join(OUTPUT_DIR, filename);
    process.stdout.write(`[${i + 1}/${urls.length}] ${filename} ... `);
    try {
      await download(url, dest);
      console.log('done');
    } catch (err) {
      console.log(`failed (${err.message})`);
    }
  }

  console.log('All downloads attempted. Files saved to:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
