import { BlockList, isIP } from "node:net";

export const CLIENT_IP_HEADER = "x-driveos-client-ip";

// Published Cloudflare origin ranges, fetched 2026-10-18 from
// https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6.
// They are used only to decide whether CF-Connecting-IP was written by
// Cloudflare. A client who can reach Render directly cannot satisfy this check.
const CLOUDFLARE_CIDRS = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32"
] as const;

const cloudflare = new BlockList();
for (const cidr of CLOUDFLARE_CIDRS) {
  const slash = cidr.lastIndexOf("/");
  const network = cidr.slice(0, slash);
  const prefix = Number(cidr.slice(slash + 1));
  const family = isIP(network);
  if (family === 4) cloudflare.addSubnet(network, prefix, "ipv4");
  else if (family === 6) cloudflare.addSubnet(network, prefix, "ipv6");
  else throw new Error(`Invalid Cloudflare range ${cidr}.`);
}

type HeaderValue = string | string[] | null | undefined;

export function parseTrustProxy(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 1;
  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "none") return 0;
  if (normalized === "1" || normalized === "true") return 1;
  if (!/^[0-9]+$/.test(normalized)) throw new Error("TRUST_PROXY must be a hop count from 0 to 32, or false.");
  const hops = Number(normalized);
  if (hops > 32) throw new Error("TRUST_PROXY must be a hop count from 0 to 32, or false.");
  return hops;
}

export function normalizeIp(value: string | null | undefined): string {
  if (!value) return "";
  let candidate = value.trim();
  if (!candidate || candidate.length > 128 || candidate.includes("%")) return "";
  if (candidate.startsWith("[") && candidate.endsWith("]") && candidate.indexOf("[", 1) === -1) candidate = candidate.slice(1, -1);
  const family = isIP(candidate);
  if (family === 4) return candidate;
  if (family !== 6) return "";
  const lower = candidate.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length);
    if (isIP(mapped) === 4) return mapped;
  }
  return lower;
}

function headerText(value: HeaderValue): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length === 1) return value[0] || "";
  return "";
}

function forwardedClosestFirst(value: HeaderValue): string[] {
  const text = headerText(value);
  if (!text) return [];
  const closestFirst: string[] = [];
  const parts = text.split(",");
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const token = parts[index].trim();
    if (!token) continue;
    const ip = normalizeIp(token);
    if (!ip) break;
    closestFirst.push(ip);
  }
  return closestFirst;
}

function isCloudflareIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return cloudflare.check(ip, "ipv4");
  if (family === 6) return cloudflare.check(ip, "ipv6");
  return false;
}

export function deriveClientIp(input: {
  socketAddress?: string | null;
  xForwardedFor?: HeaderValue;
  cfConnectingIp?: HeaderValue;
  trustHops: number;
}): string {
  const socket = normalizeIp(input.socketAddress);
  const hops = Number.isInteger(input.trustHops) && input.trustHops > 0 ? input.trustHops : 0;
  if (!socket || hops === 0) return socket;

  // Cloudflare overwrites CF-Connecting-IP. Render does not. Trust that header
  // only when the TCP peer is Cloudflare. A Cloudflare address further along
  // X-Forwarded-For is not proof: a client can egress from those ranges and
  // supply the header itself.
  const connectingIp = normalizeIp(headerText(input.cfConnectingIp));
  if (connectingIp && isCloudflareIp(socket)) return connectingIp;

  const forwarded = forwardedClosestFirst(input.xForwardedFor);
  const chain = [socket, ...forwarded];
  return chain[Math.min(hops, chain.length - 1)];
}
