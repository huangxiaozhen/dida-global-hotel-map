import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const standalone = new URL('../standalone/', import.meta.url);
const html = readFileSync(new URL('index.html', standalone), 'utf8');
const app = readFileSync(new URL('app.js', standalone), 'utf8');
const sandbox = { window: {} };

vm.runInNewContext(
  readFileSync(new URL('hotel-map-data.js', standalone), 'utf8'),
  sandbox,
);
vm.runInNewContext(
  readFileSync(new URL('map-paths.js', standalone), 'utf8'),
  sandbox,
);

const data = sandbox.window.__DIDA_HOTEL_MAP__;
const map = sandbox.window.__WORLD_MAP_PATHS__;
const paths = map.paths;
const countries = new Map(data.countries.map((country) => [country.code, country]));
const shenzhen = data.destinationsByCountry.CN.find(
  (destination) => destination.id === '6046792',
);

assert.equal(data.meta.uniqueHotels, 2_460_639);
assert.equal(countries.get('CN').count, 729_686);
assert.equal(countries.get('AU').count, 30_787);
assert.equal(shenzhen.count, 11_388);
assert(paths.some((country) => country.code === 'CN'));
assert(paths.some((country) => country.code === 'AU'));

const htmlIds = new Set(
  [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]),
);
const referencedIds = new Set(
  [...app.matchAll(/byId\(["']([^"']+)["']\)/g)].map((match) => match[1]),
);
const missingIds = [...referencedIds].filter((id) => !htmlIds.has(id));
assert.deepEqual(missingIds, []);
assert(!/https?:\/\//.test(html), 'The standalone HTML must not need a network connection.');

console.log(
  JSON.stringify(
    {
      uniqueHotels: data.meta.uniqueHotels,
      countries: data.meta.countryCount,
      destinationGroups: data.meta.destinationGroupCount,
      china: countries.get('CN').count,
      australia: countries.get('AU').count,
      shenzhenAndVicinity: shenzhen.count,
      mapPaths: paths.length,
      referencedElementIds: referencedIds.size,
    },
    null,
    2,
  ),
);
