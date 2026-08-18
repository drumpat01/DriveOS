import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { applyMigrations, openDatabase, rollbackAtlasMigration } from "../src/database.js";

const direction = process.argv[2] || "up";
if (!path.resolve(config.databasePath).startsWith(path.resolve(config.root, "data", "atlas-node-dev") + path.sep)) throw new Error("Atlas migration is restricted to the isolated local development database.");
if (!fs.existsSync(config.databasePath)) throw new Error("Development database does not exist. Run npm run seed:atlas first.");
const database = openDatabase(config.databasePath);
try {
  if (direction === "down") rollbackAtlasMigration(database, config.root);
  else if (direction === "up") applyMigrations(database, config.root);
  else throw new Error("Migration direction must be up or down.");
  process.stdout.write(`Atlas migration ${direction} completed for the isolated development database.\n`);
} finally { database.close(); }
