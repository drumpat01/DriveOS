import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

export const ATLAS_MIGRATION_VERSION = 6;

export function openDatabase(filename = config.databasePath) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;");
  return database;
}

export function applyMigrations(database: DatabaseSync, root = config.root, maximumVersion = Number.POSITIVE_INFINITY) {
  database.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);");
  const migrations = fs.readdirSync(path.join(root, "src", "Storage", "Migrations"))
    .filter(name => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0, 4)) <= maximumVersion).sort();
  const applied = new Set((database.prepare("SELECT version FROM schema_migrations").all() as Array<{ version: number }>).map(row => Number(row.version)));
  for (const name of migrations) {
    const version = Number(name.slice(0, 4));
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(root, "src", "Storage", "Migrations", name), "utf8");
    database.exec("BEGIN IMMEDIATE;");
    try {
      database.exec(sql);
      database.prepare("INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)").run(version, new Date().toISOString());
      database.exec("COMMIT;");
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }
}

export function rollbackAtlasMigration(database: DatabaseSync, root = config.root) {
  const sql = fs.readFileSync(path.join(root, "server", "migrations", "0001_atlas_read_model.down.sql"), "utf8");
  database.exec(`BEGIN IMMEDIATE;\n${sql}\nDELETE FROM schema_migrations WHERE version=${ATLAS_MIGRATION_VERSION};\nCOMMIT;`);
}
