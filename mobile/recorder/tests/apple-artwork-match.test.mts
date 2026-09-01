import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalMusicText, exactITunesArtworkMatch } from '../src/apple-artwork-match.ts';

test('Apple artwork matching normalizes punctuation but remains exact by title and artist', () => {
  assert.equal(canonicalMusicText('Khalid & LAUV'), 'khalid and lauv');
  const match = exactITunesArtworkMatch('Tied Up', 'Khalid & LAUV', [{
    wrapperType: 'track', kind: 'song', trackName: 'Tied Up', artistName: 'Khalid and LAUV',
    collectionName: 'Tied Up - Single', artworkUrl100: 'https://is1-ssl.mzstatic.com/cover.jpg',
    trackViewUrl: 'https://music.apple.com/us/song/tied-up/123',
  }]);
  assert.deepEqual(match, {
    track: 'Tied Up', artist: 'Khalid and LAUV', album: 'Tied Up - Single',
    artworkUrl: 'https://is1-ssl.mzstatic.com/cover.jpg', externalUrl: 'https://music.apple.com/us/song/tied-up/123',
  });
});

test('Apple artwork matching rejects fuzzy, non-song, and unsafe results', () => {
  assert.equal(exactITunesArtworkMatch('Tied Up', 'Khalid', [{
    wrapperType: 'track', kind: 'song', trackName: 'Tied Up (Remix)', artistName: 'Khalid',
    artworkUrl100: 'https://example.com/remix.jpg', trackViewUrl: 'https://music.apple.com/remix',
  }]), null);
  assert.equal(exactITunesArtworkMatch('Tied Up', 'Khalid', [{
    wrapperType: 'track', kind: 'music-video', trackName: 'Tied Up', artistName: 'Khalid',
    artworkUrl100: 'https://example.com/video.jpg', trackViewUrl: 'https://music.apple.com/video',
  }]), null);
  assert.equal(exactITunesArtworkMatch('Tied Up', 'Khalid', [{
    wrapperType: 'track', kind: 'song', trackName: 'Tied Up', artistName: 'Khalid',
    artworkUrl100: 'http://example.com/insecure.jpg', trackViewUrl: 'https://music.apple.com/song',
  }]), null);
});
