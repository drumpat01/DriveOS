import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createPrivateKey, sign, X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const extensionConfig = `[v3_intermediate]
basicConstraints = critical,CA:TRUE,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
1.2.840.113635.100.6.2.1 = ASN1:NULL

[v3_leaf]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
1.2.840.113635.100.6.11.1 = ASN1:NULL
`;

export interface TestChain {
  rootDer: Buffer;
  leafKeyPem: string;
  x5c: string[];
  cleanup: () => void;
}

export function createTestChain(options: { leafOid?: boolean; intermediateOid?: boolean } = {}): TestChain {
  const directory = mkdtempSync(join(tmpdir(), "retention-chain-"));
  const ext = join(directory, "ext.cnf");
  const leafOid = options.leafOid === false ? "" : "1.2.840.113635.100.6.11.1 = ASN1:NULL\n";
  const intermediateOid = options.intermediateOid === false ? "" : "1.2.840.113635.100.6.2.1 = ASN1:NULL\n";
  writeFileSync(ext, extensionConfig.replace("1.2.840.113635.100.6.2.1 = ASN1:NULL\n", intermediateOid).replace("1.2.840.113635.100.6.11.1 = ASN1:NULL\n", leafOid));
  const openssl = (args: string[]) => execFileSync("openssl", args, { stdio: "pipe" });
  openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", join(directory, "root.key")]);
  openssl(["req", "-new", "-x509", "-key", join(directory, "root.key"), "-sha256", "-days", "3650", "-subj", "/CN=Test Apple Root CA G3", "-out", join(directory, "root.crt")]);
  openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", join(directory, "intermediate.key")]);
  openssl(["req", "-new", "-key", join(directory, "intermediate.key"), "-subj", "/CN=Test Apple WWDR", "-out", join(directory, "intermediate.csr")]);
  openssl(["x509", "-req", "-in", join(directory, "intermediate.csr"), "-CA", join(directory, "root.crt"), "-CAkey", join(directory, "root.key"), "-sha256", "-days", "3650", "-extfile", ext, "-extensions", "v3_intermediate", "-out", join(directory, "intermediate.crt")]);
  openssl(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", join(directory, "leaf.key")]);
  openssl(["req", "-new", "-key", join(directory, "leaf.key"), "-subj", "/CN=Test App Store Receipt Signing", "-out", join(directory, "leaf.csr")]);
  openssl(["x509", "-req", "-in", join(directory, "leaf.csr"), "-CA", join(directory, "intermediate.crt"), "-CAkey", join(directory, "intermediate.key"), "-sha256", "-days", "3650", "-extfile", ext, "-extensions", "v3_leaf", "-out", join(directory, "leaf.crt")]);
  const leaf = new X509Certificate(readFileSync(join(directory, "leaf.crt")));
  const intermediate = new X509Certificate(readFileSync(join(directory, "intermediate.crt")));
  const rootCertificate = new X509Certificate(readFileSync(join(directory, "root.crt")));
  return {
    rootDer: rootCertificate.raw,
    leafKeyPem: readFileSync(join(directory, "leaf.key"), "utf8"),
    x5c: [leaf.raw, intermediate.raw, rootCertificate.raw].map(der => der.toString("base64")),
    cleanup: () => rmSync(directory, { recursive: true, force: true })
  };
}

export function signRealtimeRequest(chain: TestChain, payload: Record<string, unknown>, x5c = chain.x5c) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", x5c })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `${header}.${body}`;
  const signature = sign("SHA256", Buffer.from(input), { key: createPrivateKey(chain.leafKeyPem), dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}

export function tamperSignature(jws: string) {
  const parts = jws.split(".");
  const signature = parts[2] || "";
  const flipped = signature.endsWith("A") ? `${signature.slice(0, -1)}B` : `${signature.slice(0, -1)}A`;
  return `${parts[0]}.${parts[1]}.${flipped}`;
}

// The final base64url character can sit in unused bits, so flip a real signature byte.
export function breakSignature(jws: string) {
  const parts = jws.split(".");
  const bytes = Buffer.from(parts[2] || "", "base64url");
  bytes[0] = (bytes[0] ?? 0) ^ 0xff;
  parts[2] = bytes.toString("base64url");
  return parts.join(".");
}

export function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    originalTransactionId: "1000000000000001",
    appAppleId: 6806502526,
    productId: "com.journeydeck.recorder.pro.annual",
    userLocale: "en-US",
    requestIdentifier: "c03248af-dd76-4e9b-9c1e-4489cd19a768",
    environment: "Production",
    signedDate: Date.now(),
    ...overrides
  };
}
