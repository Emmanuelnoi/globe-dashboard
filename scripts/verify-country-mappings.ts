/**
 * Verify Country Name Mappings
 * Checks if all TopoJSON country names can be mapped to country-data.ts names
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Extract all country names from country-data.ts
function getCountryDataNames(): Set<string> {
  const countryDataPath = join(
    process.cwd(),
    'src/assets/data/country-data.ts',
  );
  const content = readFileSync(countryDataPath, 'utf-8');

  const nameMatches = content.matchAll(/"name":\s*"([^"]+)"/g);
  const names = new Set<string>();

  for (const match of nameMatches) {
    names.add(match[1]);
  }

  return names;
}

// Extract TopoJSON country names from the TopoJSON file
function getTopoJSONCountryNames(): Set<string> {
  try {
    const topoPath = join(
      process.cwd(),
      'public/assets/topojson/countries-110m.json',
    );
    const content = readFileSync(topoPath, 'utf-8');
    const topo = JSON.parse(content);

    const names = new Set<string>();

    // Extract from countries object
    if (topo.objects?.countries?.geometries) {
      for (const geometry of topo.objects.countries.geometries) {
        if (geometry.properties?.name) {
          names.add(geometry.properties.name);
        }
      }
    }

    return names;
  } catch (error) {
    console.error('⚠️  Could not read TopoJSON file:', error);
    return new Set();
  }
}

// Normalize function (copied from the service)
function normalizeCountryNameForDataService(meshCountryName: string): string {
  const specialCases: Record<string, string> = {
    // United States variants -> "United States"
    'United States of America': 'United States',
    'United States Of America': 'United States',
    'United States': 'United States',
    USA: 'United States',
    'U.S.A.': 'United States',
    US: 'United States',

    // United Kingdom -> "United Kingdom"
    'United Kingdom': 'United Kingdom',
    UK: 'United Kingdom',
    'Great Britain': 'United Kingdom',

    // Russia -> "Russia"
    'Russian Federation': 'Russia',
    Russia: 'Russia',

    // China -> "China"
    'Peoples Republic Of China': 'China',
    "People's Republic of China": 'China',
    'Peoples Republic of China': 'China',
    China: 'China',
    PRC: 'China',

    // South Korea -> "South Korea"
    'Republic Of Korea': 'South Korea',
    'Republic of Korea': 'South Korea',
    'South Korea': 'South Korea',
    'Korea, South': 'South Korea',

    // North Korea -> "North Korea"
    'Democratic Peoples Republic Of Korea': 'North Korea',
    "Democratic People's Republic of Korea": 'North Korea',
    'Democratic Peoples Republic of Korea': 'North Korea',
    'North Korea': 'North Korea',
    'Korea, North': 'North Korea',
    DPRK: 'North Korea',

    // Czech Republic -> "Czechia" (data uses "Czechia")
    'Czech Republic': 'Czechia',
    Czechia: 'Czechia',

    // Côte d'Ivoire -> "Ivory Coast" (data uses "Ivory Coast")
    "Côte d'Ivoire": 'Ivory Coast',
    "Côte D'ivoire": 'Ivory Coast',
    "Cote d'Ivoire": 'Ivory Coast',
    "Cote D'Ivoire": 'Ivory Coast',
    'Ivory Coast': 'Ivory Coast',

    // Congo variants
    Congo: 'Republic of the Congo',
    'Republic of the Congo': 'Republic of the Congo',
    'Congo-Brazzaville': 'Republic of the Congo',

    // DR Congo -> "DR Congo" (data uses "DR Congo")
    'Democratic Republic Of The Congo': 'DR Congo',
    'Democratic Republic of the Congo': 'DR Congo',
    'Dem Rep Congo': 'DR Congo',
    'Dem. Rep. Congo': 'DR Congo',
    'DR Congo': 'DR Congo',
    'D.R. Congo': 'DR Congo',
    DRC: 'DR Congo',
    'Congo-Kinshasa': 'DR Congo',

    // South Africa -> "South Africa"
    'South Africa': 'South Africa',
    'Republic of South Africa': 'South Africa',
    RSA: 'South Africa',

    // Other common variants
    Burma: 'Myanmar',
    'East Timor': 'Timor-Leste',
    Swaziland: 'Eswatini',
  };

  // First, try direct lookup with the input as-is
  if (specialCases[meshCountryName]) {
    return specialCases[meshCountryName];
  }

  // If not found, try with formatted name
  const formatted = formatCountryName(meshCountryName);
  if (specialCases[formatted]) {
    return specialCases[formatted];
  }

  // Return formatted name if no special case found
  return formatted;
}

function formatCountryName(meshCountryName: string): string {
  return meshCountryName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Main verification
console.log('🔍 Verifying Country Name Mappings\n');

const countryDataNames = getCountryDataNames();
console.log(`📊 Country Data has ${countryDataNames.size} countries`);

const topoNames = getTopoJSONCountryNames();
console.log(`🗺️  TopoJSON has ${topoNames.size} countries\n`);

if (topoNames.size === 0) {
  console.log(
    '⚠️  No TopoJSON countries found - skipping mapping verification',
  );
  console.log('✅ Country Data Names:\n');
  const sortedNames = Array.from(countryDataNames).sort();
  sortedNames.forEach((name) => console.log(`   - ${name}`));
} else {
  console.log('🔄 Checking TopoJSON → Country Data mappings:\n');

  const mismatches: Array<{
    topoName: string;
    normalized: string;
    found: boolean;
  }> = [];

  for (const topoName of Array.from(topoNames).sort()) {
    const normalized = normalizeCountryNameForDataService(topoName);
    const found = countryDataNames.has(normalized);

    if (found) {
      console.log(`✅ "${topoName}" → "${normalized}"`);
    } else {
      console.log(`❌ "${topoName}" → "${normalized}" (NOT FOUND IN DATA)`);
      mismatches.push({ topoName, normalized, found });
    }
  }

  if (mismatches.length > 0) {
    console.log(`\n❌ ${mismatches.length} mismatches found:\n`);
    mismatches.forEach(({ topoName, normalized }) => {
      console.log(`   "${topoName}" → "${normalized}"`);

      // Suggest possible matches
      const possibleMatches = Array.from(countryDataNames).filter((name) =>
        name.toLowerCase().includes(normalized.toLowerCase().substring(0, 5)),
      );

      if (possibleMatches.length > 0) {
        console.log(`   Possible matches:`, possibleMatches.slice(0, 3));
      }
    });
  } else {
    console.log('\n✅ All TopoJSON countries can be mapped to Country Data!');
  }
}
