/** Secret bindings are declared separately because Wrangler intentionally omits secret names from generated environment types. */
interface Env {
  /** Optional until public R2 storage is provisioned; native fallback remains available. */
  PUBLIC_PLACES?: R2Bucket;
  OVERTURE_ENABLED?: string;
  OVERTURE_RELEASE?: string;
  OVERTURE_CACHE_NAMESPACE?: string;
  LASTFM_API_KEY: string;
  SPOTIFY_CLIENT_ID: string;
}
