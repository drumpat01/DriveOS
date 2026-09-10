/** Display only; the original credit remains the identity and accessible label. */
export function compactArtistCredit(credit: string): string {
  const names = credit.split(/,\s+/).map(name => name.trim()).filter(Boolean);
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more` : credit;
}
