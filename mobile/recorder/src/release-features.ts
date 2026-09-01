/**
 * Public version-1 release gates.
 *
 * Keep the Tessie implementation in the repository, but do not expose or run
 * it in version 1. In particular, no Tessie work may share either background
 * location task used for automatic drive detection and route recording.
 */
export const TESSIE_INTEGRATION_ENABLED: boolean = false;
