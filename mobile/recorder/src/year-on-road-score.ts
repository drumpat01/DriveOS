/** Original JourneyDeck scores synthesized from deterministic oscillators. */
import type { YearOnRoadMusicId } from './year-on-road-music';

const sampleRate = 22_050;
const tau = Math.PI * 2;
const frequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

type ScoreId = YearOnRoadMusicId | 'accent';
const scores: Record<YearOnRoadMusicId, { tempo: number; chords: number[][]; motif: number[]; color: number }> = {
  dark: { tempo: 116, chords: [[45, 52, 55, 59], [41, 48, 52, 57], [43, 50, 54, 57], [40, 47, 52, 55]], motif: [0, 2, 1, 3, 2, 1, 3, 2], color: 0 },
  light: { tempo: 108, chords: [[50, 54, 57, 61], [45, 52, 57, 61], [47, 54, 59, 62], [43, 50, 55, 59]], motif: [0, 1, 2, 1, 3, 2, 1, 2], color: 1 },
  redline: { tempo: 124, chords: [[47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61], [42, 49, 54, 57]], motif: [0, 2, 3, 1, 2, 3, 1, 2], color: 2 },
  sakura: { tempo: 120, chords: [[52, 56, 59, 64], [48, 55, 59, 62], [50, 57, 60, 64], [47, 54, 59, 62]], motif: [2, 1, 3, 2, 0, 3, 1, 2], color: 3 },
};

export function renderYearOnRoadScore(id: ScoreId = 'dark'): Uint8Array {
  const accent = id === 'accent';
  const score = accent ? scores.dark : scores[id];
  const beat = 60 / score.tempo;
  const duration = accent ? 0.65 : beat * 48;
  const samples = Math.ceil(duration * sampleRate);
  const pcm = new Float64Array(samples);
  function tone(start: number, length: number, midi: number, gain: number, kind: 'pad' | 'bell' | 'bass' | 'lead') {
    const first = Math.floor(start * sampleRate), count = Math.floor(length * sampleRate), hz = frequency(midi);
    for (let i = 0; i < count && first + i < samples; i++) {
      const time = i / sampleRate;
      const envelope = kind === 'pad'
        ? Math.min(1, time / 0.16) * Math.min(1, (length - time) / 0.28)
        : Math.min(1, time / 0.008) * Math.exp(-time * (kind === 'bell' ? 4.8 : kind === 'lead' ? 2.4 : 3.5)) * Math.min(1, (length - time) / 0.08);
      const harmonic = kind === 'bell' ? 0.3 * Math.sin(tau * hz * 2 * time) : kind === 'lead' ? 0.22 * Math.sin(tau * hz * 2 * time) : 0.13 * Math.sin(tau * hz * 3 * time);
      const signal = Math.sin(tau * hz * time) + harmonic;
      pcm[first + i] += gain * envelope * signal;
    }
  }
  if (accent) {
    tone(0, 0.58, 74, 0.22, 'bell');
    tone(0.09, 0.52, 81, 0.14, 'bell');
  } else {
    const { chords, motif, color } = score;
    for (let bar = 0; bar < 12; bar++) {
      const chord = chords[bar % chords.length], start = bar * 4 * beat;
      chord.forEach(note => tone(start, beat * 4, note + 12, 0.035, 'pad'));
      for (let step = 0; step < 8; step++) {
        const note = chord[motif[(step + (bar % 2) * 3) % motif.length]] + 24;
        tone(start + step * beat / 2, beat * (color === 3 ? 1.25 : 0.9), note, color === 2 ? 0.072 : 0.062, color === 0 || color === 3 ? 'lead' : 'bell');
      }
      for (let pulse = 0; pulse < 4; pulse++) {
        tone(start + pulse * beat, beat * 0.72, chord[(pulse + (color === 1 ? 2 : 0)) % (color === 1 ? chord.length : 1)] - 12, color === 2 ? 0.15 : 0.12, 'bass');
        const first = Math.floor((start + pulse * beat) * sampleRate);
        for (let i = 0; i < sampleRate * 0.13 && first + i < samples; i++) {
          const t = i / sampleRate;
          pcm[first + i] += 0.14 * Math.exp(-30 * t) * Math.sin(tau * (48 * t + 1.6 * (1 - Math.exp(-40 * t))));
        }
        // A very soft offbeat shimmer, generated rather than sampled.
        const hat = Math.floor((start + (pulse + (color === 3 && pulse % 2 ? 0.75 : 0.5)) * beat) * sampleRate);
        for (let i = 0; i < sampleRate * 0.05 && hat + i < samples; i++) {
          const t = i / sampleRate;
          pcm[hat + i] += (color === 2 ? 0.026 : 0.018) * Math.exp(-80 * t) * Math.sin(tau * (7139 + color * 311) * t) * Math.sin(tau * 4937 * t);
        }
      }
    }
  }
  const bytes = new Uint8Array(44 + samples * 2), view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => bytes[offset + index] = character.charCodeAt(0));
  write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / (sampleRate * 0.025), (samples - i - 1) / (sampleRate * 0.18));
    view.setInt16(44 + i * 2, Math.round(Math.tanh(pcm[i]) * fade * 27_000), true);
  }
  return bytes;
}
