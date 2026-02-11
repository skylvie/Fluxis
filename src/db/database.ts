import * as fs from "node:fs";
import * as path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config/config.js";
import type { MessageMapping } from "../config/types.js";

const dbPath = path.join(process.cwd(), "cache.db");
const jsonCachePath = path.join(process.cwd(), "cache.json");

let db: Database.Database | null = null;

interface CacheData {
    forwardedMessages: Record<string, MessageMapping>;
    lastSender: Record<string, string>;
    activeVoiceCalls: Record<string, string>;
}

/**
 * Creates database schema on first run.
 * WAL mode improves concurrent read performance and reduces blocking.
 */
function initializeSchema(database: Database.Database): void {
    database.pragma("journal_mode = WAL");

    database.exec(`
        CREATE TABLE IF NOT EXISTS forwarded_messages (
            key TEXT PRIMARY KEY,
            gc1_id TEXT,
            gc2_id TEXT
        );
        
        CREATE TABLE IF NOT EXISTS last_senders (
            gc_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS active_voice_calls (
            gc_id TEXT PRIMARY KEY,
            call_id TEXT NOT NULL
        );
    `);
}

/**
 * One-time migration from legacy JSON cache to SQLite.
 * The JSON file is backed up, not deleted, to allow rollback if needed.
 */
function migrateFromJson(database: Database.Database): void {
    if (!fs.existsSync(jsonCachePath)) {
        return;
    }

    try {
        console.log("Migrating from cache.json to SQLite...");

        const raw = fs.readFileSync(jsonCachePath, "utf-8");
        const data: CacheData = JSON.parse(raw);

        const insertMessage = database.prepare(`
            INSERT OR REPLACE INTO forwarded_messages (key, gc1_id, gc2_id)
            VALUES (?, ?, ?)
        `);

        const insertSender = database.prepare(`
            INSERT OR REPLACE INTO last_senders (gc_id, user_id)
            VALUES (?, ?)
        `);

        const insertCall = database.prepare(`
            INSERT OR REPLACE INTO active_voice_calls (gc_id, call_id)
            VALUES (?, ?)
        `);

        // Wrap all inserts in a transaction for atomicity and performance
        const migrate = database.transaction(() => {
            if (data.forwardedMessages) {
                for (const [key, value] of Object.entries(data.forwardedMessages)) {
                    insertMessage.run(key, value["1"] ?? null, value["2"] ?? null);
                }
            }

            if (data.lastSender) {
                for (const [key, value] of Object.entries(data.lastSender)) {
                    insertSender.run(key, value);
                }
            }

            if (data.activeVoiceCalls) {
                for (const [key, value] of Object.entries(data.activeVoiceCalls)) {
                    insertCall.run(key, value);
                }
            }
        });

        migrate();

        const backupPath = `${jsonCachePath}.bak`;
        fs.renameSync(jsonCachePath, backupPath);
        console.log(`Migration complete! Backup: ${path.basename(backupPath)}`);
    } catch (err) {
        console.error("Migration from JSON failed:", err);
    }
}

/**
 * Initializes SQLite database for persistent state.
 *
 * @returns Database instance or null if caching is disabled in config
 */
export function initializeDatabase(): Database.Database | null {
    if (!config.cache_to_file) {
        console.log("File caching disabled");
        return null;
    }

    try {
        db = new Database(dbPath);
        initializeSchema(db);
        migrateFromJson(db);
        return db;
    } catch (err) {
        console.error("Database initialization failed:", err);
        return null;
    }
}

/**
 * Returns the active database instance.
 * Used by repositories to avoid passing db everywhere as a parameter.
 */
export function getDatabase(): Database.Database | null {
    return db;
}

/**
 * Gracefully closes database connection on shutdown.
 * Ensures WAL is checkpointed and no transactions are left open.
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        console.log("Database closed");
    }
}
