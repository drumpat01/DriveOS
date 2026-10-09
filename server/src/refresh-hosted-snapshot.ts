import { config } from "./config.js";
import { applyMigrations, openDatabase } from "./database.js";
import { refreshHostedSnapshot } from "./hosted-snapshot-refresh.js";

const database = openDatabase(config.databasePath);
try {
  applyMigrations(database, config.root);
  const result = await refreshHostedSnapshot({
    database,
    householdId: config.householdId,
    root: config.root,
    dataRoot: config.dataRoot,
    databasePath: config.databasePath,
    atlasDurableTurso: config.atlasDurableTurso,
    atlasLegacyDatabasePath: config.atlasLegacyDatabasePath,
    batchSize: config.atlasRefreshBatchSize
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  database.close();
}
