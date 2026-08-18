const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function legacyForwardingContext(upstream: string, publicOrigin = "") {
  const upstreamUrl = new URL(upstream);
  const publicUrl = new URL(publicOrigin || upstreamUrl.origin);
  const destinationOrigin = publicOrigin && loopbackHosts.has(upstreamUrl.hostname.toLowerCase())
    ? publicUrl.origin
    : upstreamUrl.origin;
  return {
    destinationOrigin,
    destinationHost: new URL(destinationOrigin).host,
    forwardedHost: publicUrl.host,
    forwardedProtocol: publicUrl.protocol.slice(0, -1)
  };
}
