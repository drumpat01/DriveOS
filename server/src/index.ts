import { createApp } from "./app.js";

const runtime = await createApp();
if (!runtime.store.status().ready && !runtime.hostedRefresh.enabled) await runtime.store.rebuildNow();
await runtime.app.listen({ host: runtime.config.host, port: runtime.config.port });
void runtime.hostedRefresh.refreshIfStale().catch(error => {
  runtime.app.log.error({ err: error }, "Startup Atlas source refresh failed");
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void runtime.app.close().finally(() => process.exit(0)); });
