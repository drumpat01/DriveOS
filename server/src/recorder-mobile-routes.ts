import type { FastifyInstance } from "fastify";
import { LastFmRecorderError, syncLastFmRecorderSession } from "./lastfm-recorder.js";
import {
  accountConnectionStatuses,
  musicProviders,
  RecorderMobileStore,
  shazamConnectionStatuses,
  type RecorderCollectionInput,
  type RecorderMemoryInput,
  type RecorderPlaceAliasInput,
  type RecorderPhotoInput,
  type RecorderMusicObservation,
  type RecorderProviderPreferences
} from "./recorder-mobile.js";

const identifier = { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9._:-]+$" } as const;
const timestamp = { type: "string", minLength: 20, maxLength: 40 } as const;
const accountStatus = { type: "string", enum: accountConnectionStatuses } as const;
const shazamStatus = { type: "string", enum: shazamConnectionStatuses } as const;
const lastFmUsername = { type: "string", minLength: 1, maxLength: 30, pattern: "^[A-Za-z0-9_-]+$" } as const;
const photoId = { type: "string", pattern: "^(?:attachment|memory_attachment)_[a-f0-9]{32}$" } as const;
const collectionId = { type: "string", pattern: "^collection_[a-f0-9]{32}$" } as const;
const memoryId = { type: "string", pattern: "^memory_[a-f0-9]{32}$" } as const;
const photoBody = {
  type: "object", additionalProperties: false, required: ["fileName", "contentType", "dataBase64"],
  properties: {
    fileName: { type: "string", minLength: 1, maxLength: 120 },
    contentType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] },
    dataBase64: { type: "string", minLength: 4, maxLength: 2_100_000, pattern: "^[A-Za-z0-9+/]+={0,2}$" }
  }
} as const;

export type RecorderMobileRouteOptions = {
  lastFmApiKey: string;
  tessieConfigured: boolean;
  lastFmFetch?: typeof fetch;
};

function validTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= Date.now() + 300_000;
}

function validOptionalHttpsUrl(value: string | null | undefined) {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
}

function hasOnlyKeys(value: unknown, allowed: string[]) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).every(key => allowed.includes(key));
}

export async function registerRecorderMobileRoutes(app: FastifyInstance, mobile: RecorderMobileStore, options: RecorderMobileRouteOptions) {
  app.get("/api/recorder/connections/status", async (_req, reply) => {
    reply.header("cache-control", "private, no-store");
    return { lastFmConfigured: Boolean(options.lastFmApiKey), tessieConfigured: options.tessieConfigured };
  });

  app.get<{ Querystring: { deviceId?: string } }>("/api/recorder/dashboard", {
    schema: { querystring: { type: "object", additionalProperties: false, properties: { deviceId: identifier } } }
  }, async (req, reply) => { reply.header("cache-control", "private, no-store"); return mobile.dashboard(req.query.deviceId); });

  app.get<{ Querystring: { limit?: string; cursor?: string } }>("/api/recorder/journeys", {
    schema: { querystring: { type: "object", additionalProperties: false, properties: { limit: { type: "string", pattern: "^[0-9]{1,2}$" }, cursor: { type: "string", maxLength: 512 } } } }
  }, async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return reply.code(400).send({ error: "Journey limit must be between 1 and 50." });
    try { return await mobile.journeys(limit, String(req.query.cursor || "")); }
    catch (error) {
      if (error instanceof Error && error.message === "The journey cursor is invalid.") return reply.code(400).send({ error: error.message });
      req.log.error({ err: error }, "Recorder journey page failed");
      return reply.code(503).send({ error: "The journey page could not be loaded." });
    }
  });

  app.get<{ Params: { id: string } }>("/api/recorder/journeys/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: identifier } } }
  }, async (req, reply) => { reply.header("cache-control", "private, no-store"); return (await mobile.journey(req.params.id)) || reply.code(404).send({ error: "Journey was not found." }); });

  app.put<{ Body: RecorderPlaceAliasInput }>("/api/recorder/places/alias", {
    schema: {
      body: {
        type: "object", additionalProperties: false, required: ["location", "label"],
        properties: { location: { type: "string", minLength: 1, maxLength: 512 }, label: { type: "string", maxLength: 64 } }
      }
    }
  }, async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    try { return await mobile.savePlaceAlias(req.body); }
    catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Location name could not be saved." }); }
  });

  app.get("/api/recorder/memories", async (_req, reply) => {
    reply.header("cache-control", "private, no-store");
    return mobile.memoriesCatalog();
  });

  app.put<{ Body: RecorderCollectionInput }>("/api/recorder/collections", {
    schema: { body: { type: "object", additionalProperties: false, required: ["name", "driveIds"], properties: { id: { anyOf: [identifier, { type: "null" }] }, name: { type: "string", minLength: 1, maxLength: 80 }, description: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] }, driveIds: { type: "array", maxItems: 100, items: identifier } } } }
  }, async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    try { return await mobile.saveCollection(req.body); }
    catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Collection could not be saved." }); }
  });

  app.put<{ Body: RecorderMemoryInput }>("/api/recorder/memories", {
    schema: { body: { type: "object", additionalProperties: false, required: ["name", "collectionIds"], properties: { id: { anyOf: [identifier, { type: "null" }] }, name: { type: "string", minLength: 1, maxLength: 80 }, notes: { anyOf: [{ type: "string", maxLength: 1200 }, { type: "null" }] }, artworkKey: { anyOf: [{ type: "string", maxLength: 40 }, { type: "null" }] }, coverPhotoId: { anyOf: [photoId, { type: "null" }] }, collectionIds: { type: "array", minItems: 2, maxItems: 50, items: identifier } } } }
  }, async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    try { return await mobile.saveMemory(req.body); }
    catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Memory could not be saved." }); }
  });

  app.post<{ Params: { id: string }; Body: RecorderPhotoInput }>("/api/recorder/collections/:id/photos", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: collectionId } }, body: photoBody }
  }, async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    try { return await mobile.addPhoto({ collectionId: req.params.id }, req.body); }
    catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Photo could not be uploaded." }); }
  });

  app.post<{ Params: { id: string }; Body: RecorderPhotoInput }>("/api/recorder/memories/:id/photos", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: memoryId } }, body: photoBody }
  }, async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    try { return await mobile.addPhoto({ memoryId: req.params.id }, req.body); }
    catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Photo could not be uploaded." }); }
  });

  app.get<{ Params: { id: string } }>("/api/recorder/photos/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: photoId } } }
  }, async (req, reply) => {
    reply.header("cache-control", "private, max-age=300");
    return (await mobile.photo(req.params.id)) || reply.code(404).send({ error: "Photo was not found." });
  });

  app.delete<{ Params: { id: string } }>("/api/recorder/photos/:id", {
    schema: { params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: photoId } } }
  }, async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    try { return await mobile.removePhoto(req.params.id); }
    catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : "Photo could not be removed." }); }
  });

  app.get<{ Params: { deviceId: string } }>("/api/recorder/preferences/:deviceId", {
    schema: { params: { type: "object", additionalProperties: false, required: ["deviceId"], properties: { deviceId: identifier } } }
  }, async (req, reply) => { reply.header("cache-control", "private, no-store"); return mobile.preferences(req.params.deviceId); });

  app.put<{ Params: { deviceId: string }; Body: Omit<RecorderProviderPreferences, "deviceId" | "updatedAt"> }>("/api/recorder/preferences/:deviceId", {
    preValidation: async (req, reply) => {
      const body = req.body as unknown as Record<string, unknown> | undefined;
      if (!hasOnlyKeys(body, ["musicProvider", "onboardingCompleted", "connections"])
        || !hasOnlyKeys(body?.connections, ["appleMusic", "shazam", "lastFm", "tessie"])) {
        return reply.code(400).send({ error: "Provider preferences contain unsupported fields." });
      }
    },
    schema: {
      params: { type: "object", additionalProperties: false, required: ["deviceId"], properties: { deviceId: identifier } },
      body: {
        type: "object", additionalProperties: false, required: ["musicProvider", "onboardingCompleted", "connections"],
        properties: {
          musicProvider: { type: ["string", "null"], enum: [...musicProviders, null] },
          onboardingCompleted: { type: "boolean" },
          connections: {
            type: "object", additionalProperties: false, required: ["appleMusic", "shazam", "lastFm", "tessie"],
            properties: { appleMusic: accountStatus, shazam: shazamStatus, lastFm: accountStatus, tessie: accountStatus }
          }
        }
      }
    }
  }, async req => mobile.savePreferences(req.params.deviceId, req.body));

  const observationSchema = {
    type: "object", additionalProperties: false,
    required: ["observationId", "source", "playedAt", "track", "artist"],
    properties: {
      observationId: identifier,
      source: { type: "string", enum: musicProviders },
      playedAt: timestamp,
      track: { type: "string", minLength: 1, maxLength: 200 },
      artist: { type: "string", minLength: 1, maxLength: 200 },
      album: { type: ["string", "null"], maxLength: 200 },
      durationMs: { type: ["integer", "null"], minimum: 0, maximum: 3_600_000 },
      artworkUrl: { type: ["string", "null"], maxLength: 2048 },
      externalUrl: { type: ["string", "null"], maxLength: 2048 },
      confidence: { type: ["number", "null"], minimum: 0, maximum: 1 }
    }
  } as const;
  app.post<{ Params: { id: string }; Body: { deviceId: string; observations: RecorderMusicObservation[] } }>("/api/recorder/sessions/:id/music", {
    preValidation: async (req, reply) => {
      const body = req.body as unknown as Record<string, unknown> | undefined;
      const observations = Array.isArray(body?.observations) ? body.observations : [];
      if (!hasOnlyKeys(body, ["deviceId", "observations"])
        || observations.some(item => !hasOnlyKeys(item, ["observationId", "source", "playedAt", "track", "artist", "album", "durationMs", "artworkUrl", "externalUrl", "confidence"]))) {
        return reply.code(400).send({ error: "Music observations contain unsupported fields. Audio and credentials are never accepted." });
      }
    },
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: identifier } },
      body: {
        type: "object", additionalProperties: false, required: ["deviceId", "observations"],
        properties: { deviceId: identifier, observations: { type: "array", minItems: 1, maxItems: 100, items: observationSchema } }
      }
    }
  }, async (req, reply) => {
    if (req.body.observations.some(item => !item.track.trim() || !item.artist.trim() || !validTimestamp(item.playedAt))) return reply.code(400).send({ error: "Every music observation requires a valid track, artist, and playback time." });
    if (req.body.observations.some(item => !validOptionalHttpsUrl(item.artworkUrl) || !validOptionalHttpsUrl(item.externalUrl))) return reply.code(400).send({ error: "Music links must use HTTPS." });
    try {
      return (await mobile.saveMusicObservations(req.params.id, req.body.deviceId, req.body.observations)) || reply.code(404).send({ error: "Recording was not found." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Music observations must fall within the recording window." || message === "Music observations require a track and artist.") {
        return reply.code(409).send({ error: message });
      }
      req.log.error({ err: error }, "Recorder music observation save failed");
      return reply.code(503).send({ error: "Music observations could not be saved." });
    }
  });

  app.post<{ Params: { id: string }; Body: { deviceId: string; username: string } }>("/api/recorder/sessions/:id/lastfm/sync", {
    preValidation: async (req, reply) => {
      if (!hasOnlyKeys(req.body, ["deviceId", "username"])) return reply.code(400).send({ error: "Last.fm sync accepts only a device and username." });
    },
    schema: {
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: identifier } },
      body: {
        type: "object", additionalProperties: false, required: ["deviceId", "username"],
        properties: { deviceId: identifier, username: lastFmUsername }
      }
    }
  }, async (req, reply) => {
    reply.header("cache-control", "private, no-store");
    try {
      return await syncLastFmRecorderSession(mobile, options.lastFmApiKey, req.params.id, req.body.deviceId, req.body.username, options.lastFmFetch);
    } catch (error) {
      if (error instanceof LastFmRecorderError) return reply.code(error.statusCode).send({ error: error.message });
      return reply.code(502).send({ error: "Last.fm sync is temporarily unavailable." });
    }
  });
}
