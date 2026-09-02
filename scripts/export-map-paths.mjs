import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json' with { type: 'json' };
import worldCountries from 'world-countries';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const outputDir = path.join(projectDir, 'standalone');
const outputPath = path.join(outputDir, 'map-paths.js');
const width = 1000;
const height = 500;

const numericToAlpha2 = new Map(
  worldCountries
    .filter((country) => country.ccn3 && country.cca2)
    .map((country) => [country.ccn3, country.cca2]),
);

const collection = feature(worldAtlas, worldAtlas.objects.countries);
const projection = geoNaturalEarth1().fitSize([width, height], collection);
const generator = geoPath(projection);
const paths = collection.features
  .map((country) => {
    const numericCode = String(country.id ?? '').padStart(3, '0');
    return {
      code: numericToAlpha2.get(numericCode) ?? '',
      path: generator(country) ?? '',
    };
  })
  .filter((country) => country.code && country.path);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(
  outputPath,
  `window.__WORLD_MAP_PATHS__=${JSON.stringify({ width, height, paths })};\n`,
  'utf8',
);

console.log(`Wrote ${paths.length} map paths to ${outputPath}`);
