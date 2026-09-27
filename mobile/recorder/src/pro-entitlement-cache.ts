export const lastPublishedProEntitlements = new Map<string, { fingerprint: string; at: number }>();

export function clearPublishedProEntitlements(scopes: Iterable<string>): void {
  for (const scope of scopes) lastPublishedProEntitlements.delete(scope);
}
