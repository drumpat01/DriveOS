/** Upgrade known Apple CDN square thumbnails at display time, including saved
 * history. Keep unknown providers/URL forms untouched and retain the original
 * URL at the call site as a fallback; the CDN may not supply every size. */
export function highQualityAlbumArtwork(uri: string | null): string | null {
  if (!uri) return null;
  try {
    const url = new URL(uri);
    if (url.protocol !== 'https:' || url.username || url.password || !/(^|\.)mzstatic\.com$/i.test(url.hostname)) return uri;
    const size = url.pathname.match(/\/(\d+)x(\d+)([a-z]{0,8})\.(jpg|jpeg|png|webp)$/i);
    if (!size || Number(size[1]) !== Number(size[2]) || Number(size[1]) >= 800) return uri;
    url.pathname = url.pathname.replace(/\/\d+x\d+([a-z]{0,8})\.(jpg|jpeg|png|webp)$/i, '/800x800$1.$2');
    return url.toString();
  } catch { return uri; }
}
