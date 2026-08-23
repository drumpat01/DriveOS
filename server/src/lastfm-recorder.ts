import { createHash } from "node:crypto";
import type { RecorderMobileStore, RecorderMusicObservation } from "./recorder-mobile.js";

const lastFmApiOrigin = "https://ws.audioscrobbler.com";
const lastFmApiPath = "/2.0/";
const requestTimeoutMs = 6_000;
const maximumPages = 5;
const tracksPerPage = 200;
const maximumResponseCharacters = 1_000_000;
const maximumSessionMs = 24 * 60 * 60 * 1_000;
const windowToleranceMs = 2 * 60 * 1_000;

type FetchLike = typeof fetch;

type LastFmTrack = {
  name?: unknown;
  artist?: unknown;
  album?: unknown;
  url?: unknown;
  mbid?: unknown;
  image?: unknown;
  date?: unknown;
  "@attr"?: unknown;
};

type LastFmResponse = {
  error?: unknown;
  recenttracks?: {
    track?: unknown;
    "@attr"?: unknown;
  };
};

export class LastFmRecorderError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "LastFmRecorderError";
  }
}
export function validLastFmUsername(value: string) {
  return /^[A-Za-z0-9_-]{1,32}$/.test(value);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedText(value: unknown, maximum = 200) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function nestedText(value: unknown, maximum = 200) {
  if (typeof value === "string") return boundedText(value, maximum);
  return boundedText(objectValue(value)?.["#text"], maximum);
}

function safeHttpsUrl(value: unknown) {
  const raw = boundedText(value, 2_048);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function artworkUrl(value: unknown) {
  if (!Array.isArray(value)) return null;
  for (const candidate of [...value].reverse()) {
    const url = safeHttpsUrl(objectValue(candidate)?.["#text"]);
    if (url) return url;
  }
  return null;
}

function pageCount(payload: LastFmResponse) {
  const raw = objectValue(payload.recenttracks?.["@attr"])?.totalPages;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximumPages) : 1;
}

function tracks(payload: LastFmResponse) {
  const raw = payload.recenttracks?.track;
  if (Array.isArray(raw)) return raw as LastFmTrack[];
  return objectValue(raw) ? [raw as LastFmTrack] : [];
}

function observationFor(track: LastFmTrack, username: string, earliestMs: number, latestMs: number): RecorderMusicObservation | null {
  if (objectValue(track["@attr"])?.nowplaying === "true") return null;
  const date = objectValue(track.date);
  const epochSeconds = Number(date?.uts);
  const playedAtMs = epochSeconds * 1_000;
  if (!Number.isSafeInteger(epochSeconds) || !Number.isFinite(playedAtMs) || playedAtMs < earliestMs || playedAtMs > latestMs) return null;

  const name = boundedText(track.name);
  const artist = nestedText(track.artist);
  if (!name || !artist) return null;
  const album = nestedText(track.album) || null;
  const digest = createHash("sha256")
    .update(`${username.toLocaleLowerCase()}\0${epochSeconds}\0${boundedText(track.mbid, 80)}\0${artist.toLocaleLowerCase()}\0${name.toLocaleLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
  return {
    observationId: `lastfm:${epochSeconds}:${digest}`,
    source: "lastfm",
    playedAt: new Date(playedAtMs).toISOString(),
    track: name,
    artist,
    album,
    artworkUrl: artworkUrl(track.image),
    externalUrl: safeHttpsUrl(track.url)
  };
}

async function responsePayload(response: Response): Promise<LastFmResponse> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumResponseCharacters) {
    throw new LastFmRecorderError("Last.fm sync is temporarily unavailable.", 502);
  }
  const body = await response.text();
  if (body.length > maximumResponseCharacters) throw new LastFmRecorderError("Last.fm sync is temporarily unavailable.", 502);
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as LastFmResponse;
  } catch {
    throw new LastFmRecorderError("Last.fm sync is temporarily unavailable.", 502);
  }
}

async function fetchPage(fetchImpl: FetchLike, apiKey: string, username: string, from: number, to: number, page: number) {
  const url = new URL(lastFmApiPath, lastFmApiOrigin);
  url.searchParams.set("method", "user.getRecentTracks");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("user", username);
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  url.searchParams.set("limit", String(tracksPerPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("extended", "0");
  url.searchParams.set("format", "json");
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
  } catch {
    throw new LastFmRecorderError("Last.fm sync is temporarily unavailable.", 502);
  }
  if (!response.ok) throw new LastFmRecorderError("Last.fm sync is temporarily unavailable.", 502);
  const payload = await responsePayload(response);
  if (payload.error !== undefined || !payload.recenttracks) throw new LastFmRecorderError("Last.fm sync is temporarily unavailable.", 502);
  return payload;
}

export async function syncLastFmRecorderSession(
  mobile: Pick<RecorderMobileStore, "recordingWindow" | "saveMusicObservations">,
  apiKey: string,
  sessionId: string,
  deviceId: string,
  username: string,
  fetchImpl: FetchLike = fetch
) {
  if (!apiKey) throw new LastFmRecorderError("Last.fm sync is not configured.", 503);
  if (!validLastFmUsername(username)) throw new LastFmRecorderError("A valid Last.fm username is required.", 400);
  const window = await mobile.recordingWindow(sessionId, deviceId);
  if (!window) throw new LastFmRecorderError("Recording was not found.", 404);
  if (window.status !== "completed" || !window.endedAt) throw new LastFmRecorderError("Finish the journey before syncing Last.fm.", 409);
  const startedAtMs = Date.parse(window.startedAt), endedAtMs = Date.parse(window.endedAt);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs < startedAtMs || endedAtMs - startedAtMs > maximumSessionMs) {
    throw new LastFmRecorderError("The journey time window cannot be synced with Last.fm.", 409);
  }

  const earliestMs = startedAtMs - windowToleranceMs;
  const latestMs = endedAtMs + windowToleranceMs;
  const from = Math.floor(earliestMs / 1_000);
  const to = Math.ceil(latestMs / 1_000);
  const observations = new Map<string, RecorderMusicObservation>();
  let pages = 1;
  for (let page = 1; page <= pages && page <= maximumPages; page += 1) {
    const payload = await fetchPage(fetchImpl, apiKey, username, from, to, page);
    pages = page === 1 ? pageCount(payload) : pages;
    for (const track of tracks(payload)) {
      const observation = observationFor(track, username, earliestMs, latestMs);
      if (observation) observations.set(observation.observationId, observation);
    }
  }
  const saved = await mobile.saveMusicObservations(sessionId, deviceId, [...observations.values()]);
  if (!saved) throw new LastFmRecorderError("Recording was not found.", 404);
  return { synced: observations.size, total: saved.total };
}
