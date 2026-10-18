// Web Crypto verification for Apple's Retention Messaging JWS.
// Mirrors SignedDataVerifier.verifyAndDecodeRealtimeRequest with online checks
// off: x5c length 3, leaf + intermediate, trust anchored at the pinned roots,
// receipt-signing and WWDR extension OIDs, 60s date skew, ES256. No OCSP.
// DER parsing is synchronous and is done for the pinned Apple root and WWDR G6
// at module load. crypto.subtle.importKey stays on the request and is memoized
// once per isolate. The request leaf is parsed once.

const MAX_SKEW_MS = 60_000;
const CERT_CACHE_LIMIT = 16;
const RECEIPT_OID = "1.2.840.113635.100.6.11.1";
const WWDR_OID = "1.2.840.113635.100.6.2.1";
const BASIC_CONSTRAINTS_OID = "2.5.29.19";
const EC_PUBLIC_KEY_OID = "1.2.840.10045.2.1";

const utf8Decoder = new TextDecoder();

const attributeLabel: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.5": "serialNumber",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "1.2.840.113549.1.9.1": "emailAddress"
};

const hashByOid: Record<string, CertHash> = {
  "1.2.840.10045.4.3.2": "SHA-256",
  "1.2.840.10045.4.3.3": "SHA-384",
  "1.2.840.10045.4.3.4": "SHA-512"
};

const curveByOid: Record<string, CertCurve> = {
  "1.2.840.10045.3.1.7": "P-256",
  "1.3.132.0.34": "P-384",
  "1.3.132.0.35": "P-521"
};

export type RetentionRejectReason =
  | "app_mismatch"
  | "environment_mismatch"
  | "invalid_chain"
  | "invalid_certificate"
  | "invalid_signature";

export class RetentionVerifyError extends Error {
  readonly statusCode: 401 | 403;
  readonly reason: RetentionRejectReason;

  constructor(reason: RetentionRejectReason) {
    super(reason);
    this.name = "RetentionVerifyError";
    this.reason = reason;
    this.statusCode = reason === "app_mismatch" || reason === "environment_mismatch" ? 403 : 401;
  }
}

export interface DecodedRetentionRequest {
  originalTransactionId: string;
  appAppleId: number;
  productId: string;
  userLocale: string;
  requestIdentifier: string;
  signedDate: number;
  environment: string;
  bundleId?: string;
}

type CertHash = "SHA-256" | "SHA-384" | "SHA-512";
type CertCurve = "P-256" | "P-384" | "P-521";

interface Der {
  tag: number;
  header: number;
  start: number;
  end: number;
  next: number;
}

export interface PreparedCertificate {
  id: string;
  der: Uint8Array;
  subject: string;
  issuer: string;
  notBefore: number;
  notAfter: number;
  isCa: boolean;
  hasReceiptOid: boolean;
  hasWwdrOid: boolean;
  curve: CertCurve;
  signatureHash: CertHash;
  signatureDer: Uint8Array;
  tbs: ArrayBuffer;
  spki: ArrayBuffer;
}

export interface ParsedCertificate extends PreparedCertificate {
  key: CryptoKey;
}

class DerError extends Error {
  constructor() {
    super("invalid certificate");
    this.name = "DerError";
  }
}

const preparedById = new Map<string, PreparedCertificate>();
const preparedByBytes = new WeakMap<Uint8Array, PreparedCertificate>();
const preparedByBase64 = new Map<string, PreparedCertificate>();
const x5cTextCache = new Map<string, PreparedCertificate>();
const keyPromises = new Map<string, Promise<CryptoKey>>();
const chainVerdicts = new Map<string, Promise<boolean>>();
const pinnedIds = new Set<string>();

function fail(reason: RetentionRejectReason): never {
  throw new RetentionVerifyError(reason);
}

function coordinateSize(curve: CertCurve) {
  switch (curve) {
    case "P-256":
      return 32;
    case "P-384":
      return 48;
    case "P-521":
      return 66;
    default: {
      const exhaustive: never = curve;
      return exhaustive;
    }
  }
}

function cacheKey(bytes: Uint8Array) {
  let high = 0x811c9dc5;
  let low = 0x01000193;
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index] ?? 0;
    high ^= byte;
    high = Math.imul(high, 0x01000193);
    low ^= byte;
    low = Math.imul(low, 0x811c9dc5);
  }
  return `${bytes.length}:${high >>> 0}:${low >>> 0}`;
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0;
}

function copyBytes(bytes: Uint8Array) {
  return new Uint8Array(bytes);
}

function trimPrepared(keep: string) {
  let extras = 0;
  for (const id of preparedById.keys()) if (!pinnedIds.has(id)) extras += 1;
  if (extras <= CERT_CACHE_LIMIT) return;
  for (const id of preparedById.keys()) {
    if (pinnedIds.has(id) || id === keep) continue;
    preparedById.delete(id);
    extras -= 1;
    if (extras <= CERT_CACHE_LIMIT) break;
  }
}

function trimTextCache(keep: string) {
  while (x5cTextCache.size > CERT_CACHE_LIMIT) {
    const oldest = x5cTextCache.keys().next().value;
    if (!oldest || oldest === keep) break;
    x5cTextCache.delete(oldest);
  }
}

function trimChainCache(keep: string) {
  while (chainVerdicts.size > CERT_CACHE_LIMIT) {
    const oldest = chainVerdicts.keys().next().value;
    if (!oldest || oldest === keep) break;
    chainVerdicts.delete(oldest);
  }
}

function readDer(bytes: Uint8Array, offset: number): Der {
  if (offset < 0 || offset >= bytes.length) throw new DerError();
  const tag = bytes[offset];
  const lengthByte = bytes[offset + 1];
  if (tag === undefined || lengthByte === undefined) throw new DerError();
  let length = 0;
  let start = offset + 2;
  if ((lengthByte & 0x80) !== 0) {
    const count = lengthByte & 0x7f;
    if (count === 0 || count > 3 || offset + 2 + count > bytes.length) throw new DerError();
    for (let index = 0; index < count; index += 1) length = (length << 8) | (bytes[offset + 2 + index] ?? 0);
    start = offset + 2 + count;
  } else {
    length = lengthByte;
  }
  const end = start + length;
  if (end > bytes.length) throw new DerError();
  return { tag, header: offset, start, end, next: end };
}

function children(bytes: Uint8Array, node: Der) {
  const nodes: Der[] = [];
  let offset = node.start;
  while (offset < node.end) {
    const child = readDer(bytes, offset);
    if (child.next > node.end) throw new DerError();
    nodes.push(child);
    offset = child.next;
  }
  return nodes;
}

function oidText(bytes: Uint8Array, node: Der) {
  if (node.tag !== 0x06 || node.end <= node.start) throw new DerError();
  const first = bytes[node.start] ?? 0;
  const parts = [Math.floor(first / 40), first % 40];
  let value = 0;
  for (let index = node.start + 1; index < node.end; index += 1) {
    const byte = bytes[index] ?? 0;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join(".");
}

function decodeDirectoryString(tag: number, bytes: Uint8Array) {
  if (tag === 0x0c || tag === 0x13 || tag === 0x16) return utf8Decoder.decode(bytes);
  if (tag === 0x1e) {
    let text = "";
    for (let index = 0; index + 1 < bytes.length; index += 2) {
      text += String.fromCharCode(((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0));
    }
    return text;
  }
  throw new DerError();
}

function readName(bytes: Uint8Array, node: Der) {
  const rdns: string[] = [];
  for (const set of children(bytes, node)) {
    if (set.tag !== 0x31) throw new DerError();
    const attributes: string[] = [];
    for (const sequence of children(bytes, set)) {
      const pair = children(bytes, sequence);
      const oid = pair[0];
      const value = pair[1];
      if (!oid || !value || oid.tag !== 0x06) throw new DerError();
      const id = oidText(bytes, oid);
      attributes.push(`${attributeLabel[id] ?? id}=${decodeDirectoryString(value.tag, bytes.subarray(value.start, value.end))}`);
    }
    rdns.push(attributes.join("+"));
  }
  return rdns.join("\n");
}

function readTime(bytes: Uint8Array, node: Der) {
  const text = utf8Decoder.decode(bytes.subarray(node.start, node.end));
  const utc = node.tag === 0x17;
  if (!utc && node.tag !== 0x18) throw new DerError();
  const match = utc
    ? /^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(text)
    : /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(text);
  if (!match) throw new DerError();
  let year = Number(match[1]);
  if (utc) year += year >= 50 ? 1900 : 2000;
  const time = Date.UTC(year, Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  if (Number.isNaN(time)) throw new DerError();
  return time;
}

function extensionFields(bytes: Uint8Array, node: Der) {
  const parts = children(bytes, node);
  const oid = parts[0];
  if (!oid || oid.tag !== 0x06) throw new DerError();
  let index = 1;
  if (parts[index]?.tag === 0x01) index += 1;
  const value = parts[index];
  if (!value || value.tag !== 0x04) throw new DerError();
  return { oid: oidText(bytes, oid), value };
}

function readIsCa(bytes: Uint8Array, octet: Der) {
  if (octet.start === octet.end) return false;
  const sequence = readDer(bytes, octet.start);
  if (sequence.tag !== 0x30 || sequence.start === sequence.end) return false;
  const first = readDer(bytes, sequence.start);
  return first.tag === 0x01 && first.end > first.start && (bytes[first.start] ?? 0) !== 0;
}

function algorithmOid(bytes: Uint8Array, node: Der) {
  const oid = children(bytes, node)[0];
  if (!oid) throw new DerError();
  return oidText(bytes, oid);
}

function unsignedFixed(bytes: Uint8Array, size: number) {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  const length = bytes.length - start;
  if (length > size) return undefined;
  const out = new Uint8Array(size);
  out.set(bytes.subarray(start), size - length);
  return out;
}

function ecdsaDerToRaw(signatureDer: Uint8Array, size: number) {
  const sequence = readDer(signatureDer, 0);
  if (sequence.tag !== 0x30 || sequence.header !== 0 || sequence.next !== signatureDer.length) return undefined;
  const parts = children(signatureDer, sequence);
  const r = parts[0];
  const s = parts[1];
  if (!r || !s || parts.length !== 2 || r.tag !== 0x02 || s.tag !== 0x02) return undefined;
  const rFixed = unsignedFixed(signatureDer.subarray(r.start, r.end), size);
  const sFixed = unsignedFixed(signatureDer.subarray(s.start, s.end), size);
  if (!rFixed || !sFixed) return undefined;
  const raw = new Uint8Array(size * 2);
  raw.set(rFixed, 0);
  raw.set(sFixed, size);
  return raw;
}

function bufferSource(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function sliceBuffer(bytes: Uint8Array, start: number, end: number) {
  const copy = new Uint8Array(end - start);
  copy.set(bytes.subarray(start, end));
  return copy.buffer;
}

function prepareCertificate(bytes: Uint8Array): PreparedCertificate {
  const der = copyBytes(bytes);
  const certificate = readDer(der, 0);
  if (certificate.tag !== 0x30 || certificate.header !== 0 || certificate.next !== der.length) throw new DerError();
  const top = children(der, certificate);
  const tbsNode = top[0];
  const signatureAlgorithm = top[1];
  const signatureBits = top[2];
  if (!tbsNode || !signatureAlgorithm || !signatureBits || tbsNode.tag !== 0x30 || signatureBits.tag !== 0x03) throw new DerError();
  const tbsChildren = children(der, tbsNode);
  let index = tbsChildren[0]?.tag === 0xa0 ? 1 : 0;
  const issuer = tbsChildren[index + 2];
  const validity = tbsChildren[index + 3];
  const subject = tbsChildren[index + 4];
  const spki = tbsChildren[index + 5];
  if (!issuer || !validity || !subject || !spki) throw new DerError();
  const times = children(der, validity);
  const notBefore = times[0];
  const notAfter = times[1];
  if (!notBefore || !notAfter) throw new DerError();
  const spkiParts = children(der, spki);
  const spkiAlgorithm = spkiParts[0];
  if (!spkiAlgorithm || algorithmOid(der, spkiAlgorithm) !== EC_PUBLIC_KEY_OID) throw new DerError();
  const curveOid = children(der, spkiAlgorithm)[1];
  if (!curveOid) throw new DerError();
  const curve = curveByOid[oidText(der, curveOid)];
  const signatureHash = hashByOid[algorithmOid(der, signatureAlgorithm)];
  if (!curve || !signatureHash) throw new DerError();
  if ((der[signatureBits.start] ?? 1) !== 0) throw new DerError();
  let isCa = false;
  let hasReceiptOid = false;
  let hasWwdrOid = false;
  const extensions = tbsChildren.find(node => node.tag === 0xa3);
  if (extensions) {
    const extensionList = children(der, readDer(der, extensions.start));
    for (const extension of extensionList) {
      const field = extensionFields(der, extension);
      if (field.oid === BASIC_CONSTRAINTS_OID) isCa = readIsCa(der, field.value);
      if (field.oid === RECEIPT_OID) hasReceiptOid = true;
      if (field.oid === WWDR_OID) hasWwdrOid = true;
    }
  }
  return {
    id: cacheKey(der),
    der,
    subject: readName(der, subject),
    issuer: readName(der, issuer),
    notBefore: readTime(der, notBefore),
    notAfter: readTime(der, notAfter),
    isCa,
    hasReceiptOid,
    hasWwdrOid,
    curve,
    signatureHash,
    signatureDer: copyBytes(der.subarray(signatureBits.start + 1, signatureBits.end)),
    tbs: sliceBuffer(der, tbsNode.header, tbsNode.next),
    spki: sliceBuffer(der, spki.header, spki.next)
  };
}

function rememberPrepared(bytes: Uint8Array, prepared: PreparedCertificate, pinned: boolean) {
  preparedById.set(prepared.id, prepared);
  preparedByBytes.set(bytes, prepared);
  if (pinned) pinnedIds.add(prepared.id);
  else trimPrepared(prepared.id);
  return prepared;
}

export function pinPreparedCertificate(bytes: Uint8Array) {
  const prepared = rememberPrepared(bytes, prepareCertificate(bytes), true);
  preparedByBase64.set(encodeBase64(bytes), prepared);
  return prepared;
}

export function loadPrepared(bytes: Uint8Array) {
  const known = preparedByBytes.get(bytes);
  if (known) return known;
  const id = cacheKey(bytes);
  const cached = preparedById.get(id);
  if (cached && sameBytes(cached.der, bytes)) {
    preparedByBytes.set(bytes, cached);
    return cached;
  }
  return rememberPrepared(bytes, prepareCertificate(bytes), false);
}

function certificateKey(certificate: PreparedCertificate) {
  const cached = keyPromises.get(certificate.id);
  if (cached) return cached;
  const pending = crypto.subtle.importKey("spki", certificate.spki, { name: "ECDSA", namedCurve: certificate.curve }, false, ["verify"]);
  keyPromises.set(certificate.id, pending);
  pending.catch(() => {
    if (keyPromises.get(certificate.id) === pending) keyPromises.delete(certificate.id);
  });
  return pending;
}

export async function loadCertificate(bytes: Uint8Array): Promise<ParsedCertificate> {
  const prepared = loadPrepared(bytes);
  return { ...prepared, key: await certificateKey(prepared) };
}

export async function certificateSignedBy(child: PreparedCertificate, issuer: PreparedCertificate) {
  const raw = ecdsaDerToRaw(child.signatureDer, coordinateSize(issuer.curve));
  if (!raw) return false;
  return crypto.subtle.verify({ name: "ECDSA", hash: child.signatureHash }, await certificateKey(issuer), bufferSource(raw), child.tbs);
}

function datesCover(certificate: PreparedCertificate, effective: number) {
  return certificate.notBefore <= effective + MAX_SKEW_MS && certificate.notAfter >= effective - MAX_SKEW_MS;
}

function bytesFromBinary(binary: string) {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return bytesFromBinary(atob(padded));
}

function decodeBase64(value: string) {
  return bytesFromBinary(atob(value));
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index] ?? 0);
  return btoa(binary);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodePayload(bytes: Uint8Array): DecodedRetentionRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Decoder.decode(bytes));
  } catch {
    fail("invalid_signature");
  }
  if (!isRecord(parsed)) fail("invalid_signature");
  const { originalTransactionId, appAppleId, productId, userLocale, requestIdentifier, signedDate, environment, bundleId } = parsed;
  if (typeof originalTransactionId !== "string" || typeof appAppleId !== "number" || typeof productId !== "string" || typeof userLocale !== "string" || typeof requestIdentifier !== "string" || typeof signedDate !== "number" || typeof environment !== "string") {
    fail("invalid_signature");
  }
  const decoded: DecodedRetentionRequest = { originalTransactionId, appAppleId, productId, userLocale, requestIdentifier, signedDate, environment };
  if (typeof bundleId === "string") decoded.bundleId = bundleId;
  return decoded;
}

function headerChain(bytes: Uint8Array) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Decoder.decode(bytes));
  } catch {
    fail("invalid_certificate");
  }
  if (!isRecord(parsed)) fail("invalid_certificate");
  const alg = typeof parsed.alg === "string" ? parsed.alg : "";
  const x5c = Array.isArray(parsed.x5c) ? parsed.x5c : [];
  if (x5c.length !== 3) fail("invalid_chain");
  if (!x5c.every(item => typeof item === "string")) fail("invalid_certificate");
  return { alg, x5c: x5c as string[] };
}

export interface InspectedJws {
  payload: DecodedRetentionRequest;
  leaf: PreparedCertificate;
  intermediate: PreparedCertificate;
  signature: Uint8Array;
  signingInput: Uint8Array;
}

function certificateFromX5c(encoded: string) {
  const pinned = preparedByBase64.get(encoded);
  if (pinned) return pinned;
  const cached = x5cTextCache.get(encoded);
  if (cached) return cached;
  try {
    const prepared = loadPrepared(decodeBase64(encoded));
    x5cTextCache.set(encoded, prepared);
    trimTextCache(encoded);
    return prepared;
  } catch (error) {
    if (error instanceof RetentionVerifyError) throw error;
    fail("invalid_certificate");
  }
}

export function inspectRetentionJws(signedPayload: string): InspectedJws {
  const parts = signedPayload.split(".");
  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const encodedSignature = parts[2];
  if (!encodedHeader || !encodedPayload || !encodedSignature || parts.length !== 3) fail("invalid_signature");
  let headerBytes: Uint8Array;
  let signature: Uint8Array;
  try {
    headerBytes = decodeBase64Url(encodedHeader);
    signature = decodeBase64Url(encodedSignature);
  } catch {
    fail("invalid_signature");
  }
  const header = headerChain(headerBytes);
  if (header.alg !== "ES256" || signature.byteLength !== 64) fail("invalid_signature");
  let payloadBytes: Uint8Array;
  try {
    payloadBytes = decodeBase64Url(encodedPayload);
  } catch {
    fail("invalid_signature");
  }
  const payload = decodePayload(payloadBytes);
  const leaf = certificateFromX5c(header.x5c[0] ?? "");
  const intermediate = certificateFromX5c(header.x5c[1] ?? "");
  const signingInput = new Uint8Array(encodedHeader.length + 1 + encodedPayload.length);
  signingInput.set(utf8DecoderBytes(encodedHeader), 0);
  signingInput[encodedHeader.length] = 0x2e;
  signingInput.set(utf8DecoderBytes(encodedPayload), encodedHeader.length + 1);
  return { payload, leaf, intermediate, signature, signingInput };
}

function utf8DecoderBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index);
  return bytes;
}

function namedRoots(intermediate: PreparedCertificate, roots: readonly Uint8Array[]) {
  const matches: PreparedCertificate[] = [];
  for (const rootBytes of roots) {
    let candidate: PreparedCertificate;
    try {
      candidate = loadPrepared(rootBytes);
    } catch {
      continue;
    }
    if (intermediate.issuer === candidate.subject) matches.push(candidate);
  }
  return matches;
}

function chainIsTrusted(leaf: PreparedCertificate, intermediate: PreparedCertificate, root: PreparedCertificate) {
  const id = `${leaf.id}|${intermediate.id}|${root.id}`;
  const cached = chainVerdicts.get(id);
  if (cached) return cached;
  const pending = Promise.all([
    certificateSignedBy(intermediate, root),
    certificateSignedBy(leaf, intermediate)
  ]).then(([intermediateOk, leafOk]) => intermediateOk && leafOk);
  chainVerdicts.set(id, pending);
  trimChainCache(id);
  pending.catch(() => {
    if (chainVerdicts.get(id) === pending) chainVerdicts.delete(id);
  });
  return pending;
}

function jwsSignatureValid(inspected: InspectedJws) {
  return certificateKey(inspected.leaf).then(key => crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    bufferSource(inspected.signature),
    bufferSource(inspected.signingInput)
  ));
}

export async function verifyInspectedRetentionJws(inspected: InspectedJws, roots: readonly Uint8Array[], expectedEnvironment: string) {
  const { leaf, intermediate, payload } = inspected;
  if (leaf.curve !== "P-256") fail("invalid_signature");
  const candidates = namedRoots(intermediate, roots);
  if (candidates.length === 0 || !intermediate.isCa || !intermediate.hasWwdrOid || !leaf.hasReceiptOid || leaf.issuer !== intermediate.subject) {
    fail("invalid_signature");
  }
  const covered = candidates.filter(root => datesCover(leaf, payload.signedDate) && datesCover(intermediate, payload.signedDate) && datesCover(root, payload.signedDate));
  if (covered.length === 0) fail("invalid_certificate");
  const trust = Promise.all(covered.map(root => chainIsTrusted(leaf, intermediate, root))).then(results => results.some(Boolean));
  const [trusted, signed] = await Promise.all([trust, jwsSignatureValid(inspected)]);
  if (!trusted || !signed) fail("invalid_signature");
  if (payload.environment !== expectedEnvironment) fail("environment_mismatch");
  return payload;
}

export async function verifyRetentionJws(signedPayload: string, roots: readonly Uint8Array[], expectedEnvironment: string) {
  return verifyInspectedRetentionJws(inspectRetentionJws(signedPayload), roots, expectedEnvironment);
}
