import { config } from "./config.js";
import { waitForCompatibility } from "./compatibility-readiness.js";

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

try {
  const result = await waitForCompatibility({
    upstream: config.legacyUpstream,
    publicOrigin: config.publicOrigin,
    probeTimeoutMs: positiveInteger("DRIVEOS_COMPATIBILITY_PROBE_TIMEOUT_MS", 1500),
    startupTimeoutMs: positiveInteger("DRIVEOS_COMPATIBILITY_STARTUP_TIMEOUT_MS", 180_000),
    intervalMs: positiveInteger("DRIVEOS_COMPATIBILITY_PROBE_INTERVAL_MS", 500),
    requiredConsecutiveSuccesses: positiveInteger("DRIVEOS_COMPATIBILITY_READY_SUCCESSES", 2)
  });
  process.stdout.write(`${JSON.stringify({ compatibilityReady: true, ...result })}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Compatibility readiness failed.");
  process.exitCode = 1;
}
