import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { legacyForwardingContext } from "./legacy-forwarding.js";

export type CompatibilityWaitOptions = {
  upstream: string;
  publicOrigin: string;
  probeTimeoutMs?: number;
  startupTimeoutMs?: number;
  intervalMs?: number;
  requiredConsecutiveSuccesses?: number;
};

export async function compatibilityReady(upstream: string, publicOrigin: string, timeoutMs = 1500) {
  if (!upstream) return true;
  const url = new URL("/healthz", upstream), forwarding = legacyForwardingContext(upstream, publicOrigin);
  return await new Promise<boolean>(resolve => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(url, { headers: { host: forwarding.forwardedHost, "x-forwarded-host": forwarding.forwardedHost, "x-forwarded-proto": forwarding.forwardedProtocol } }, response => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 400));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Compatibility readiness timed out.")));
    request.on("error", () => resolve(false));
  });
}

export async function compatibilityProcessReady(upstream: string, readyFile: string, timeoutMs = 500) {
  if (!upstream) return true;
  if (!readyFile || !fs.existsSync(readyFile)) return false;
  const url = new URL(upstream), port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  return await new Promise<boolean>(resolve => {
    const socket = net.createConnection({ host: url.hostname, port });
    let settled = false;
    const finish = (ready: boolean) => { if (settled) return; settled = true; socket.destroy(); resolve(ready); };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export async function waitForCompatibility(options: CompatibilityWaitOptions) {
  const probeTimeoutMs = options.probeTimeoutMs ?? 1500;
  const startupTimeoutMs = options.startupTimeoutMs ?? 180_000;
  const intervalMs = options.intervalMs ?? 500;
  const requiredConsecutiveSuccesses = options.requiredConsecutiveSuccesses ?? 2;
  if (probeTimeoutMs < 1 || startupTimeoutMs < 1 || intervalMs < 1 || requiredConsecutiveSuccesses < 1) throw new Error("Compatibility readiness timing values must be positive.");
  if (!options.upstream) return { ready: true, attempts: 0, elapsedMs: 0 };

  const startedAt = Date.now();
  let attempts = 0, consecutiveSuccesses = 0;
  while (Date.now() - startedAt < startupTimeoutMs) {
    attempts++;
    if (await compatibilityReady(options.upstream, options.publicOrigin, probeTimeoutMs)) {
      consecutiveSuccesses++;
      if (consecutiveSuccesses >= requiredConsecutiveSuccesses) return { ready: true, attempts, elapsedMs: Date.now() - startedAt };
    } else {
      consecutiveSuccesses = 0;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Compatibility service did not become ready within ${startupTimeoutMs} ms.`);
}
