import fs from 'node:fs/promises';
import path from 'node:path';

const METADATA_PATH = path.resolve('litematic-metadata/litematics.json');
const RENDERS_DIR = path.resolve('litematic-renders-cropped');
const OUTPUT_PATH = path.resolve('litematics-processed.json');

async function loadMetadata() {
  const raw = await fs.readFile(METADATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.entries)) {
    throw new Error('Invalid metadata file: expected an "entries" array.');
  }

  return parsed;
}

async function loadImageNames() {
  const dirents = await fs.readdir(RENDERS_DIR, { withFileTypes: true });
  const pngs = dirents.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'));
  return new Set(pngs.map((entry) => entry.name.toLowerCase()));
}

function withHasImage(metadata, imageNames) {
  const entries = metadata.entries.map((entry) => {
    const pngName = entry.file.replace(/\.litematic$/i, '.png').toLowerCase();
    const hasImage = imageNames.has(pngName);
    return { ...entry, has_image: hasImage };
  });

  return { ...metadata, entries };
}

async function main() {
  const metadata = await loadMetadata();
  const imageNames = await loadImageNames();

  const updated = withHasImage(metadata, imageNames);
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(updated, null, 2)}\n`);

  console.log(`Processed ${updated.entries.length} entries.`);
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Failed to mark entries:', err);
  process.exit(1);
});
