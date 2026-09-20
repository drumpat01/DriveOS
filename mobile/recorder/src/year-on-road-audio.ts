import { useEffect, useRef, useState } from 'react';
import type { YearOnRoadMusicId } from './year-on-road-music';

type Player = { play(): void; pause(): void; seekTo(seconds: number): Promise<void>; release(): void; loop: boolean; volume: number };
type RecapAudio = {
  createAudioPlayer(source: number, options: { keepAudioSessionActive: true }): Player;
  setAudioModeAsync(mode: { playsInSilentMode: boolean; shouldPlayInBackground: boolean; interruptionMode: 'mixWithOthers'; allowsRecording: boolean }): Promise<void>;
};

function musicSource(id: YearOnRoadMusicId) {
  if (id === 'light') return require('../assets/year-on-road-sunlit-coast-v1.wav');
  if (id === 'redline') return require('../assets/year-on-road-champagne-apex-v1.wav');
  if (id === 'sakura') return require('../assets/year-on-road-petal-rush-v1.wav');
  return require('../assets/year-on-road-midnight-velocity-v1.wav');
}

/** Load audio only after an explicit Sound tap. Old binaries can still open the silent recap. */
export function useYearOnRoadAudio(enabled: boolean, playing: boolean, chapter: number, musicId: YearOnRoadMusicId) {
  const players = useRef<{ bed: Player; accent: Player; musicId: YearOnRoadMusicId } | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [readyVersion, setReadyVersion] = useState(0);
  const previousChapter = useRef(chapter);
  useEffect(() => {
    if (!enabled || players.current || available === false) return;
    let cancelled = false;
    void (async () => {
      let bed: Player | null = null, accent: Player | null = null;
      try {
        // A guarded lazy require avoids the missing native ExpoAudio exception
        // during startup on existing binaries without this optional module.
        const audio = require('expo-audio') as RecapAudio;
        await audio.setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers', allowsRecording: false });
        if (cancelled) return;
        // Shazam's native AVAudioEngine is outside Expo's player registry. The
        // default pause/completion path deactivates the shared AVAudioSession,
        // even if Shazam just started. Leave session ownership to that engine.
        // Expo Audio 57 release tears down players without deactivating it.
        bed = audio.createAudioPlayer(musicSource(musicId), { keepAudioSessionActive: true });
        accent = audio.createAudioPlayer(require('../assets/year-on-road-accent-v1.wav'), { keepAudioSessionActive: true });
        bed.loop = true; bed.volume = 0.45; accent.volume = 0.28;
        players.current = { bed, accent, musicId };
        setAvailable(true); setReadyVersion(version => version + 1);
      } catch {
        try { bed?.release(); } catch { /* Release any partially initialized native player. */ }
        try { accent?.release(); } catch { /* Keep the recap readable if audio is unavailable. */ }
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, available, musicId]);
  useEffect(() => {
    const current = players.current;
    if (!current || current.musicId === musicId) return;
    let replacement: Player | null = null;
    try {
      const audio = require('expo-audio') as RecapAudio;
      replacement = audio.createAudioPlayer(musicSource(musicId), { keepAudioSessionActive: true });
      replacement.loop = true; replacement.volume = 0.45;
      if (enabled && playing) replacement.play();
      players.current = { ...current, bed: replacement, musicId };
      try { current.bed.pause(); } catch { /* A replacement is already ready. */ }
      try { current.bed.release(); } catch { /* Do not interrupt the new score. */ }
    } catch {
      try { replacement?.release(); } catch { /* Keep the previous score alive. */ }
    }
  }, [enabled, musicId, playing, readyVersion]);
  useEffect(() => {
    const current = players.current;
    if (!current) return;
    try { if (enabled && playing) current.bed.play(); else { current.bed.pause(); current.accent.pause(); } }
    catch { setAvailable(false); }
  }, [enabled, playing, readyVersion]);
  useEffect(() => {
    const changed = previousChapter.current !== chapter;
    previousChapter.current = chapter;
    const current = players.current;
    if (!changed || !enabled || !playing || !current) return;
    let cancelled = false;
    void current.accent.seekTo(0).then(() => { if (!cancelled) current.accent.play(); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [chapter, enabled, playing]);
  useEffect(() => () => {
    const current = players.current; players.current = null;
    for (const player of current ? [current.bed, current.accent] : []) {
      try { player.pause(); } catch { /* A failed pause must not skip releasing native memory. */ }
      try { player.release(); } catch { /* Native release must not block closing. */ }
    }
  }, []);
  return available;
}
