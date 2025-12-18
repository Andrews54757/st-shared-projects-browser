#!/usr/bin/env node
/**
 * Extracts version and size information from every .litematic file in a folder.
 * Usage: node extract-litematic-info.mjs [inputDir] [outputDir]
 * Defaults: inputDir = ./litematic-files, outputDir = ./litematic-metadata
 */

import fs from 'fs/promises';
import path from 'path';
import { Litematic } from '@kleppe/litematic-reader';

const DEFAULT_INPUT_DIR = path.join(process.cwd(), 'litematic-files');
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'litematic-metadata');
const OUTPUT_FILENAME = 'litematics.json';
const VERSION_DATA_URL = 'https://raw.githubusercontent.com/misode/mcmeta/refs/heads/summary/versions/data.json';

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function loadVersionData() {
    if (process.env.OFFLINE === '1') {
        console.log('OFFLINE=1 set, skipping Minecraft version metadata download.');
        return null;
    }

    try {
        const res = await fetch(VERSION_DATA_URL);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        return await res.json();
    } catch (err) {
        console.warn(`Could not fetch version data, will fall back to dataVersion only: ${err.message}`);
        return null;
    }
}

function lookupVersion(dataVersion, versionList) {
    if (!versionList) return null;
    const found = versionList.find((v) => v.data_version === dataVersion);
    return found ? found.id : null;
}

function extractDimensions(blocks) {
    if (!blocks) {
        return { x: 0, y: 0, z: 0 };
    }
    return {
        x: blocks.maxx - blocks.minx + 1,
        y: blocks.maxy - blocks.miny + 1,
        z: blocks.maxz - blocks.minz + 1,
    };
}

async function readLitematic(filePath, versionList) {
    const buffer = await fs.readFile(filePath);
    const litematic = new Litematic(buffer);
    await litematic.read();

    const nbtData = litematic.litematic?.nbtData ?? {};
    const blocks = litematic.litematic?.blocks;
    const dims = extractDimensions(blocks);
    const dataVersion = nbtData.MinecraftDataVersion ?? 0;
    const timeCreated = nbtData.Metadata?.TimeCreated?.toString() || null;
    const author = nbtData.Metadata?.Author;
    //console.log(nbtData)
    const versionId = lookupVersion(dataVersion, versionList);

    const stats = await fs.stat(filePath);

    return {
        file: path.basename(filePath),
        fileSizeBytes: stats.size,
        dimensions: dims,
        size: `${dims.x}x${dims.y}x${dims.z}`,
        dataVersion,
        version: versionId || 'Unknown',
        timeCreated,
        author
    };
}

async function main() {
    const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_INPUT_DIR;
    const outputDir = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT_DIR;

    await ensureDir(outputDir);

    const versionList = await loadVersionData();
    const entries = [];
    const errors = [];

    const files = await fs.readdir(inputDir);
    for (const file of files) {
        if (!file.toLowerCase().endsWith('.litematic')) continue;
        const fullPath = path.join(inputDir, file);
        try {
            const info = await readLitematic(fullPath, versionList);
            entries.push(info);
            process.stdout.write(`Processed ${file}\r`);
        } catch (err) {
            errors.push({ file, error: err.message });
            console.error(`Failed ${file}: ${err.message}`);
        }
    }

    // Keep output stable and readable
    entries.sort((a, b) => a.file.localeCompare(b.file));

    const output = {
        generatedAt: new Date().toISOString(),
        sourceDir: inputDir,
        total: entries.length,
        errors,
        entries,
    };

    const outputPath = path.join(outputDir, OUTPUT_FILENAME);
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\nSaved metadata for ${entries.length} litematics to ${outputPath}`);
    if (errors.length > 0) {
        console.log(`Encountered ${errors.length} errors, see "errors" in the JSON for details.`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
