import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const EXPECTED_COLUMN_COUNT = 23;

const sourcePath = resolve(process.argv[2] || '../HotelSummary (5).csv');
const outputPath = resolve(
  process.argv[3] || 'public/hokkaido/hokkaido-hotels.js',
);

function repairParts(parts) {
  if (parts.length === EXPECTED_COLUMN_COUNT) return parts;
  if (parts.length > EXPECTED_COLUMN_COUNT) {
    const overflow = parts.length - EXPECTED_COLUMN_COUNT;
    const repaired = [
      ...parts.slice(0, 3),
      parts.slice(3, 4 + overflow).join(' | '),
      ...parts.slice(4 + overflow),
    ];
    if (repaired.length === EXPECTED_COLUMN_COUNT) return repaired;
  }
  return null;
}

function text(value) {
  return (value || '').trim();
}

function numberOrNull(value) {
  if (!text(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinateOrNull(value) {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Number(parsed.toFixed(6));
}

const japanHotels = [];
const hokkaidoDestinationIds = new Set();
const seenHotelIds = new Set();
let malformedRows = 0;
let firstLine = true;

const lines = createInterface({
  input: createReadStream(sourcePath, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of lines) {
  if (firstLine) {
    firstLine = false;
    continue;
  }

  const parts = repairParts(line.split('|'));
  if (!parts) {
    malformedRows += 1;
    continue;
  }

  const hotelId = text(parts[0]);
  if (!hotelId || seenHotelIds.has(hotelId)) continue;
  seenHotelIds.add(hotelId);

  if (text(parts[8]).toUpperCase() !== 'JP') continue;

  const destinationId = text(parts[18]);
  if (text(parts[7]).toLowerCase() === 'hokkaido') {
    hokkaidoDestinationIds.add(destinationId);
  }

  japanHotels.push({
    id: hotelId,
    name: text(parts[1]),
    nameCn: text(parts[2]),
    address: text(parts[3]),
    addressCn: text(parts[21]),
    city: text(parts[5]),
    cityCn: text(parts[6]),
    state: text(parts[7]),
    zipCode: text(parts[11]),
    longitude: coordinateOrNull(parts[12]),
    latitude: coordinateOrNull(parts[13]),
    starRating: numberOrNull(parts[14]),
    propertyCategory: text(parts[17]),
    destinationId,
    destination: text(parts[19]),
    destinationCn: text(parts[20]),
    updatedAt: text(parts[22]),
  });
}

const hotels = japanHotels
  .filter((hotel) => hokkaidoDestinationIds.has(hotel.destinationId))
  .sort((a, b) => {
    const destinationCompare = (a.destinationCn || a.destination).localeCompare(
      b.destinationCn || b.destination,
      'zh-CN',
    );
    if (destinationCompare !== 0) return destinationCompare;
    return (a.nameCn || a.name).localeCompare(b.nameCn || b.name, 'zh-CN');
  });

const hasUsableCoordinates = (hotel) =>
  hotel.latitude !== null &&
  hotel.longitude !== null &&
  hotel.latitude >= 41 &&
  hotel.latitude <= 46 &&
  hotel.longitude >= 139 &&
  hotel.longitude <= 146;

const destinationCounts = new Map();
for (const hotel of hotels) {
  const key = `${hotel.destinationId}\u0000${hotel.destinationCn}\u0000${hotel.destination}`;
  destinationCounts.set(key, (destinationCounts.get(key) || 0) + 1);
}

const destinations = [...destinationCounts]
  .map(([key, count]) => {
    const [id, nameCn, name] = key.split('\u0000');
    return { id, nameCn, name, count };
  })
  .sort((a, b) => b.count - a.count || a.nameCn.localeCompare(b.nameCn, 'zh-CN'));

const mappedHotels = hotels.filter(hasUsableCoordinates).length;
const payload = {
  meta: {
    source: 'HotelSummary (5).csv',
    generatedAt: new Date().toISOString(),
    totalHotels: hotels.length,
    mappedHotels,
    hotelsWithoutCoordinates: hotels.length - mappedHotels,
    destinationCount: destinations.length,
    malformedRowsSkipped: malformedRows,
    coordinateBounds: {
      south: 41,
      west: 139,
      north: 46,
      east: 146,
    },
  },
  destinations,
  hotels,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `window.__DIDA_HOKKAIDO_HOTELS__=${JSON.stringify(payload)};\n`,
  'utf8',
);

console.log(
  JSON.stringify(
    {
      outputPath,
      totalHotels: hotels.length,
      mappedHotels,
      hotelsWithoutCoordinates: hotels.length - mappedHotels,
      destinationCount: destinations.length,
      malformedRowsSkipped: malformedRows,
    },
    null,
    2,
  ),
);
