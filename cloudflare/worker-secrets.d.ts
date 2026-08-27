/** Secret bindings are declared separately because Wrangler intentionally omits secret names from generated environment types. */
interface Env {
  LASTFM_API_KEY: string;
  SPOTIFY_CLIENT_ID: string;
}
