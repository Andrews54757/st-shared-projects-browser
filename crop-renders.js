import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const INPUT_DIR = path.resolve('litematic-renders');
const OUTPUT_DIR = path.resolve('litematic-renders-cropped');

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function listPngs() {
  const entries = await fs.readdir(INPUT_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'));
}

async function processImage(filename) {
  const inputPath = path.join(INPUT_DIR, filename);
  const outputPath = path.join(OUTPUT_DIR, filename);

  // Check if the image contains transparency; only trim when needed.
  const stats = await sharp(inputPath).stats();
  let pipeline = sharp(inputPath);
  if (!stats.isOpaque) {
    pipeline = pipeline.trim();
  }

  await pipeline.png().toFile(outputPath);
}

async function main() {
  await ensureOutputDir();
  const pngs = await listPngs();

  if (pngs.length === 0) {
    console.log('No PNG files found in', INPUT_DIR);
    return;
  }

  console.log(`Processing ${pngs.length} PNG files...`);
  let completed = 0;

  for (const entry of pngs) {
    try {
      await processImage(entry.name);
      completed += 1;
      if (completed % 50 === 0 || completed === pngs.length) {
        console.log(`Processed ${completed}/${pngs.length}`);
      }
    } catch (err) {
      console.error(`Failed to process ${entry.name}: ${err.message}`);
    }
  }

  console.log(`Done. Cropped images saved to ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
