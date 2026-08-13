import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const projectRoot = path.resolve(root, '..');
const port = Number(process.env.DRIVEOS_TEST_PORT || 8790);

function demoArtwork(label, start, end) {
  const artwork = [
    '/assets/driveos-logo-v3.png',
    '/assets/DriveOS-Icon-v2.png',
    '/assets/favicon.png',
    '/driveos-icon-squircle.png'
  ];
  const seed = [...String(label)].reduce((total, character) => total + character.charCodeAt(0), 0);
  return artwork[seed % artwork.length];
}

const catalog = [
  ['Open Roads', 'Nova Lane', 'Daybreak', '#22c7a6', '#076c89'],
  ['City Lights', 'The Skylines', 'After Hours', '#5b4cf0', '#0ec3d8'],
  ['Northbound', 'Paper Satellites', 'Signals', '#ed6a5a', '#6d3bd1'],
  ['Blue Horizon', 'Mira Vale', 'Coastline', '#1982c4', '#6a4c93'],
  ['Green Mile', 'The Waypoints', 'Long Way Home', '#2cb67d', '#1b4332'],
  ['Radio Static', 'Juniper Drive', 'Frequency', '#ff9f1c', '#d62828'],
  ['Night Map', 'Atlas Echo', 'Coordinates', '#26356f', '#06b6d4'],
  ['Slow Morning', 'Harbor Bloom', 'Sunday', '#f28482', '#84a59d'],
  ['Interstate', 'Parallel Lines', 'Motion', '#4361ee', '#3a0ca3'],
  ['Homeward', 'Copper Pines', 'Golden Hour', '#e09f3e', '#9e2a2b']
].map(([track, artist, album, start, end], index) => ({
  track,
  artist,
  album,
  trackId: `demotrack${String(index + 1).padStart(3, '0')}`,
  albumImage: demoArtwork(album, start, end),
  spotifyUrl: 'https://open.spotify.com/',
  durationMs: 180000 + index * 6000
}));

const recent = Array.from({ length: 21 }, (_, index) => ({
  ...catalog[index % catalog.length],
  playedAt: new Date(Date.UTC(2026, 7, 10, 16, 40 - index * 3)).toISOString(),
  time: new Date(Date.UTC(2026, 7, 10, 16, 40 - index * 3)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }),
  source: index % 3 === 0 ? 'lastfm' : 'spotify'
}));

function makeDrive(index, overrides = {}) {
  const startedAt = new Date(Date.UTC(2026, 7, 10 - index, 13, 15));
  const soundtrack = catalog.slice(index % 4, index % 4 + 4).map((song, songIndex) => ({
    ...song,
    playedAt: new Date(startedAt.getTime() + (songIndex + 1) * 9 * 60000).toISOString(),
    time: `${8 + songIndex}:2${songIndex} AM`
  }));
  return {
    id: `demo-drive-${index + 1}`,
    startedAt: startedAt.toISOString(),
    endedAt: new Date(startedAt.getTime() + 52 * 60000).toISOString(),
    dateLabel: `Demo Day ${index + 1}`,
    shortDateLabel: `Aug ${10 - index}`,
    dateIso: `2026-08-${String(10 - index).padStart(2, '0')}`,
    dateNumeric: `8/${10 - index}/2026`,
    startTime: '8:15 AM',
    endTime: '9:07 AM',
    startingLocation: index % 2 ? 'Pinecrest, ST' : 'Lakeview, ST',
    endingLocation: index % 2 ? 'Harbor Point, ST' : 'Riverton, ST',
    rawStartingLocation: `${120 + index} Demo Avenue`,
    rawEndingLocation: `${800 + index} Sample Boulevard`,
    startingLatitude: 39.72 + index * .004,
    startingLongitude: -104.99 + index * .004,
    endingLatitude: 39.78 + index * .004,
    endingLongitude: -104.90 + index * .004,
    durationMinutes: 52,
    miles: 24.6 + index * 1.2,
    startingBattery: 78 - index,
    endingBattery: 68 - index,
    batteryUsed: 10,
    energyKWh: 5.8,
    efficiencyWhMi: 236,
    averageSpeed: 34,
    maxSpeed: 68,
    soundtrack,
    songCount: soundtrack.length,
    ...overrides
  };
}

const drives = Array.from({ length: 10 }, (_, index) => makeDrive(index));
const topTracks = catalog.map((song, index) => ({ ...song, plays: 18 - index }));
const topArtists = catalog.map((song, index) => ({
  artist: song.artist,
  plays: 44 - index * 3,
  imageUrl: song.albumImage,
  imageSource: index % 3 === 0 ? 'album' : 'artist',
  spotifyUrl: 'https://open.spotify.com/'
}));

const routePoints = Array.from({ length: 18 }, (_, index) => ({
  timestamp: 1786377600 + index * 180,
  latitude: 39.72 + index * .0035,
  longitude: -104.99 + index * .005,
  speed: index === 0 ? 0 : 34 + index,
  heading: 72,
  battery: 78 - Math.floor(index / 2)
}));

const responses = {
  '/api/status': { driveOS: 'online', tessie: true, spotify: true, lastfm: true, lastfmUsername: 'demo-listener', foursquare: true, foursquareCached: 7, playlistScope: true },
  '/api/vehicle': { name: 'Aurora', state: 'online', battery: 72, rangeMiles: 185, charging: 'Disconnected', chargeLimit: 80, insideTempF: 72, outsideTempF: 76, latitude: 39.7392, longitude: -104.9903, heading: 194, speedMph: 0, shiftState: 'P', gpsAsOf: 1786377600, odometerMiles: 14096.49 },
  '/api/vehicle/live': { name: 'Aurora', state: 'online', battery: 72, rangeMiles: 185, charging: 'Disconnected', chargeLimit: 80, insideTempF: 72, outsideTempF: 76, latitude: 39.7392, longitude: -104.9903, heading: 194, speedMph: 38, shiftState: 'D', gpsAsOf: 1786377600, odometerMiles: 14096.49 },
  '/api/spotify/recent': { recent, newlyArchived: 4, archiveTotal: 1427, lastFmConfigured: true, lastFmUsername: 'demo-listener' },
  '/api/spotify/auth-status': { authorized: true },
  '/api/lastfm/status': { configured: true, username: 'demo-listener' },
  '/api/foursquare/status': { configured: true, cachedCount: 7, todayUsed: 2, todayLimit: 10, monthUsed: 18, monthLimit: 250 },
  '/api/drives': { windowDays: 365, drives },
  '/api/music/stats': { totalPlays: 1427, topTracks, topArtists, daily: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label, index) => ({ label, count: 4 + ((index * 7) % 18) })) },
  '/api/statistics': { periodDays: 30, driveCount: 38, totalMiles: 624.8, totalEnergyKWh: 147.3, totalBatteryUsed: 264, averageWhMi: 236, soundtrackSongs: 184 },
  '/api/places': { places: [
    { location: '120 Demo Avenue', label: 'Studio', manualLabel: 'Studio', displayName: 'Studio', source: 'manual', uses: 8 },
    { location: '500 Sample Way', label: '', manualLabel: '', businessName: 'Demo Coffee', businessCategory: 'Coffee Shop', businessDistanceMeters: 18, displayName: 'Demo Coffee', source: 'foursquare', uses: 6 }
  ], savedCount: 1, newMatches: 0, foursquare: { configured: true, cachedCount: 7, todayUsed: 2, todayLimit: 10, monthUsed: 18, monthLimit: 250 } },
  '/api/charging': { settings: { electricityRateCents: 12.5 }, summary30: { sessions: 7, energyAddedKWh: 184, cost: 23, superchargerSessions: 1 }, sessions: [] },
  '/api/dashboard/layout': { version: 1, updatedAt: null, layout: null },
  '/api/recap': { recaps: [{ monthKey: '2026-08', monthLabel: 'August 2026', driveCount: 38, miles: 624.8, driveEnergyKWh: 147.3, averageWhMi: 236, batteryUsed: 264, soundtrackPlays: 184, uniqueSongs: 91, favoriteRoute: 'Lakeview, ST to Riverton, ST', favoriteRouteCount: 9, longestDriveMiles: 52.4, longestDriveDate: 'Sat, Aug 8', chargingSessions: 7, chargingEnergyKWh: 184, chargingCost: 23, chargingKnownCostSessions: 7 }], settings: { electricityRateCents: 12.5 } },
  '/api/drive/map': { driveId: 'demo-drive-1', provider: 'OpenFreeMap', routePoints, songMarkers: routePoints.slice(3, 15).filter((_, index) => index % 3 === 0).map((point, index) => ({ ...point, index: index + 1, track: catalog[index].track, artist: catalog[index].artist, albumImage: catalog[index].albumImage })), startMarker: routePoints[0], endMarker: routePoints[routePoints.length - 1], stateCount: routePoints.length },
  '/api/drive/share-card': { schemaVersion: 1, driveId: 'demo-drive-1', title: 'Saturday Morning Drive', dateLabel: 'Saturday, August 8', routeLabel: 'Lakeview, ST to Riverton, ST', startLabel: 'Lakeview, ST', endLabel: 'Riverton, ST', route: { mode: 'city-private', points: [{ x: .08, y: .84 }, { x: .28, y: .68 }, { x: .52, y: .52 }, { x: .74, y: .34 }, { x: .92, y: .12 }], mapPoints: routePoints.map(point => ({ latitude: point.latitude, longitude: point.longitude })), songMarkers: [{ index: 1, latitude: 39.75, longitude: -104.95, locationMode: 'synthetic-progress' }] }, stats: { miles: 24.6, durationMinutes: 52, efficiencyWhMi: 236, songs: 4, topArtist: 'Nova Lane' }, featured: { track: 'Open Roads', artist: 'Nova Lane', album: 'Daybreak', trackId: null, albumImage: catalog[0].albumImage, momentContext: 'started near Lakeview, ST' }, privacy: { homeProtected: true, homeReplacement: 'Lakeview, ST', homeCoordinatesIncluded: false, routeCoordinates: 'city-level-synthetic', songCoordinates: 'time-projected-synthetic', rawAddressesIncluded: false, note: 'Demo locations are fictional and contain no personal address data.' } }
};

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/spotify/artwork/')) {
    const artwork = ['driveos-logo-v3.png', 'DriveOS-Icon-v2.png', 'favicon.png'];
    const match = url.pathname.match(/(\d+)$/);
    const index = match ? Number(match[1]) % artwork.length : 0;
    const file = path.join(projectRoot, 'assets', artwork[index]);
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    const body = responses[url.pathname] ?? { success: true };
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
    return;
  }

  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const staticRoot = requestPath === '/driveos-icon-squircle.png' ? projectRoot : root;
  const file = path.resolve(staticRoot, `.${requestPath}`);
  if (!file.startsWith(staticRoot) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`DriveOS mock server listening on ${port}`));
