import { createApp } from "./app.js";

const runtime = await createApp();
const status = runtime.store.status();
if (!status.ready) await runtime.store.rebuildNow();
await runtime.app.listen({ host: runtime.config.host, port: runtime.config.port });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void runtime.app.close().finally(() => process.exit(0)); });
