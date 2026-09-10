import assert from 'node:assert/strict';
import test from 'node:test';
import { appleSongCatalogId, resolveAppleArtwork } from '../src/apple-artwork-resolver.ts';

const item = { track: 'Loser, Baby', artist: 'Keith David, Blake Roman, Andrew Underberg, Hazbin Hotel & Sam Haft' };
const result = { wrapperType: 'track', kind: 'song', trackId: 6789638005, trackName: item.track, artistName: item.artist, collectionName: 'Hazbin Hotel (Original Soundtrack)', artworkUrl100: 'https://is1-ssl.mzstatic.com/cover/100x100bb.jpg', trackViewUrl: 'https://music.apple.com/us/song/loser-baby/6789638005' };
test('extracts song IDs without confusing albums, artists, or untrusted URLs', () => {
  assert.equal(appleSongCatalogId(result.trackViewUrl), '6789638005');
  assert.equal(appleSongCatalogId('https://music.apple.com/us/album/name/123?i=456'), '456');
  for (const url of ['https://music.apple.com/us/album/name/123', 'https://music.apple.com/us/artist/name/123', 'https://evil.test/song/123', 'https://music.apple.com@evil.test/song/123', 'https://music.apple.com/song/0']) assert.equal(appleSongCatalogId(url), null);
});
test('catalog ID recovers artwork without text search while retaining local identity', async () => {
  const urls: string[] = [];
  const found = await resolveAppleArtwork({ ...item, externalUrl: result.trackViewUrl }, async url => { urls.push(url); return { results: [result] }; });
  assert.equal(urls.length, 1); assert.match(urls[0], /lookup\?id=6789638005/);
  assert.equal(found?.track, item.track); assert.equal(found?.artist, item.artist);
});
test('older entries recover through the exact artist catalog when song search misses', async () => {
  const urls: string[] = [];
  const found = await resolveAppleArtwork(item, async url => {
    urls.push(url);
    return { results: url.includes('entity=musicArtist') ? [{ wrapperType: 'artist', artistName: 'Keith David', artistId: 17113790 }] : url.includes('lookup?') ? [result] : [{ ...result, trackName: 'Poison' }] };
  });
  assert.equal(urls.length, 3); assert.equal(found?.artworkUrl, result.artworkUrl100);
});
test('rejects covers and ambiguous artist matches', async () => {
  const found = await resolveAppleArtwork(item, async url => ({ results: url.includes('entity=musicArtist') ? [{ wrapperType: 'artist', artistName: 'Keith David', artistId: 1 }, { wrapperType: 'artist', artistName: 'Keith David', artistId: 2 }] : [{ ...result, artistName: 'Cover artist' }] }));
  assert.equal(found, null);
});
