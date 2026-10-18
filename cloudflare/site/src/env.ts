export interface AssetsBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface SiteEnv {
  ASSETS: AssetsBinding;
  RENDER_ORIGIN: string;
  JOURNEYDECK_RETENTION_MESSAGE_ID?: string;
  JOURNEYDECK_RETENTION_ENVIRONMENTS?: string;
  // Local fixture runs only (localhost, 127.0.0.1, ::1). Never set these in wrangler.jsonc.
  ALLOW_RETENTION_TEST_ROOT?: string;
  RETENTION_TEST_ROOT_BASE64?: string;
}
