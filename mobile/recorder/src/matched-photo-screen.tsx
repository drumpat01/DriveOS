import { saveReplayPhotoTiming } from './journey-replay-photos';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useAppTheme } from './app-theme';
import { appDataClient } from './app-data';
import { getCurrentUser } from './auth';
import { getMemoryIncludingDeleted, listPhotos } from './local-store';
import { notifyLocalArchiveChanged } from './local-archive-events';
import { useJourneyDeckNavigation } from './native-navigation-context';
import { DetailScreenFrame } from './detail-screen-frame';
import { loadPhotoMatchingMemory } from './feature-archive-data';
import { PhotoMatchingScreen } from './photo-matching-screen';
import type { MatchedPhotoImport } from './photo-matching-library';
import type { PhotoMatch } from './photo-matching-model';

export function NativeMatchedPhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(), c = useAppTheme().palette, nav = useJourneyDeckNavigation();
  const [owner] = useState(() => getCurrentUser().id), [data, setData] = useState<ReturnType<typeof loadPhotoMatchingMemory> | null>(null);
  const [error, setError] = useState<string | null>(null), active = useRef(true), inFlight = useRef(false), generation = useRef(0);
  const reviewKey = `${owner}:${id}`, currentReview = useRef(reviewKey); currentReview.current = reviewKey;
  useEffect(() => { active.current = true; setData(null); const timer = setTimeout(() => {
    try { setData(loadPhotoMatchingMemory(owner, id)); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not load this Memory.'); }
  }, 100); return () => { active.current = false; generation.current++; clearTimeout(timer); }; }, [owner, id]);
  const importPhoto = useCallback(async (photo: MatchedPhotoImport, match: PhotoMatch) => {
    const token = generation.current;
    const assertOwner = () => {
      if (!active.current || token !== generation.current || currentReview.current !== `${owner}:${id}` || getCurrentUser().id !== owner) throw new Error('Your profile changed. Reopen this Memory.');
      const memory = getMemoryIncludingDeleted(owner, id);
      if (!memory || memory.deletedAt) throw new Error('This Memory was removed. No more photos will be added.');
    };
    assertOwner();
    if (inFlight.current) throw new Error('Please wait for the current photo to finish.');
    inFlight.current = true;
    try {
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${owner}\n${id}\n${match.asset.id}`);
      assertOwner();
      const fileName = `matched-${digest}.jpg`;
      const existing = listPhotos(owner).find(existing => existing.memoryId === id && existing.fileName === fileName);
      const saved = existing ?? await appDataClient.uploadMemoryPhoto(id, { ...photo, fileName });
      assertOwner();
      saveReplayPhotoTiming(owner, saved.id, match.journeyId, match.asset.createdAtUtc);
      assertOwner(); notifyLocalArchiveChanged();
    } finally { inFlight.current = false; }
  }, [owner, id]);
  const close = () => { if (inFlight.current) return; void nav.refreshArchive().catch(() => undefined); router.back(); };
  if (data) return <PhotoMatchingScreen reviewKey={`${owner}:${id}`} memoryName={data.name} journeys={data.journeys} onImport={importPhoto} onClose={close} />;
  return <DetailScreenFrame title="Find matching photos" onBack={close}><View style={{ padding: 28 }}>
    {error ? <Text accessibilityRole="alert" style={{ color: c.muted }}>{error}</Text> : <ActivityIndicator color={c.accent} />}
  </View></DetailScreenFrame>;
}
