#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";

const PROJECT_ROOT = process.cwd();
const OUTPUT_DIR = join(PROJECT_ROOT, "public", "flags");
const FLAG_ICONS_DIR = join(
  PROJECT_ROOT,
  "node_modules",
  "flag-icons",
  "flags",
  "4x3",
);
const COUNTRY_DATA_PATH = join(
  PROJECT_ROOT,
  "src",
  "assets",
  "data",
  "country-data.ts",
);
const QUESTION_GENERATOR_PATH = join(
  PROJECT_ROOT,
  "src",
  "app",
  "features",
  "quiz",
  "services",
  "question-generator.service.ts",
);

function readCountryCodes() {
  const text = readFileSync(COUNTRY_DATA_PATH, "utf8");
  return [
    ...new Set([...text.matchAll(/code: '([A-Z]{3})'/g)].map((m) => m[1])),
  ];
}

function readIso3ToIso2Map() {
  const text = readFileSync(QUESTION_GENERATOR_PATH, "utf8");
  const match = text.match(
    /const codeMap: \{ \[key: string\]: string \} = \{([\s\S]*?)\n\s*\};/,
  );

  if (!match) {
    throw new Error(
      "Unable to find ISO code map in question-generator.service.ts",
    );
  }

  return Object.fromEntries(
    [...match[1].matchAll(/\b([A-Z]{3}):\s*'([a-z]{2})'/g)].map((m) => [
      m[1],
      m[2].toUpperCase(),
    ]),
  );
}

function iso2ToFlagEmoji(twoLetterCode) {
  const normalizedCode = twoLetterCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return "🏳️";
  }

  const OFFSET = 127397;
  return String.fromCodePoint(
    ...normalizedCode.split("").map((char) => char.charCodeAt(0) + OFFSET),
  );
}

function buildSvg(flagEmoji, iso2Code) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80" role="img" aria-label="Flag ${iso2Code}">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#20242f"/>
      <stop offset="100%" stop-color="#11151d"/>
    </linearGradient>
  </defs>
  <rect width="120" height="80" rx="8" fill="url(#bg)"/>
  <rect x="1" y="1" width="118" height="78" rx="7" fill="none" stroke="rgba(255,255,255,0.18)"/>
  <text
    x="60"
    y="52"
    text-anchor="middle"
    font-size="42"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
  >${flagEmoji}</text>
</svg>
`;
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const iso3Codes = readCountryCodes();
  const isoMap = readIso3ToIso2Map();
  const hasRealFlagIcons = existsSync(FLAG_ICONS_DIR);

  let created = 0;
  let copied = 0;

  for (const iso3Code of iso3Codes) {
    const iso2Code = (isoMap[iso3Code] || iso3Code.slice(0, 2)).toUpperCase();
    const outputPath = join(OUTPUT_DIR, `${iso2Code.toLowerCase()}.svg`);

    const packagedFlagPath = join(
      FLAG_ICONS_DIR,
      `${iso2Code.toLowerCase()}.svg`,
    );

    if (hasRealFlagIcons && existsSync(packagedFlagPath)) {
      copyFileSync(packagedFlagPath, outputPath);
      copied++;
      created++;
      continue;
    }

    const emoji = iso2ToFlagEmoji(iso2Code);
    writeFileSync(outputPath, buildSvg(emoji, iso2Code), "utf8");
    created++;
  }

  if (hasRealFlagIcons) {
    console.log(
      `Generated ${created} local SVG flag assets in public/flags (${copied} real assets copied, ${created - copied} fallback assets generated)`,
    );
  } else {
    console.log(
      `Generated ${created} local SVG flag assets in public/flags (flag-icons not installed, so fallback assets were generated)`,
    );
  }
}

main();
