import type Database from "better-sqlite3";
import type { MessageMapping } from "../../config/types.js";
import { getDatabase } from "../database.js";

/**
 * Prepared statements cached at module level for performance.
 * better-sqlite3 requires preparing statements once and reusing them.
 * Preparing on every call would waste ~100µs per operation.
 */
let selectStmt: Database.Statement | null = null;
let insertStmt: Database.Statement | null = null;
let deleteStmt: Database.Statement | null = null;
let selectAllStmt: Database.Statement | null = null;

function getStatements(db: Database.Database): {
    select: Database.Statement;
    insert: Database.Statement;
    delete: Database.Statement;
    selectAll: Database.Statement;
} {
    if (!selectStmt) {
        selectStmt = db.prepare("SELECT * FROM forwarded_messages WHERE key = ?");
    }
    if (!insertStmt) {
        insertStmt = db.prepare(`
            INSERT OR REPLACE INTO forwarded_messages (key, gc1_id, gc2_id)
            VALUES (?, ?, ?)
        `);
    }
    if (!deleteStmt) {
        deleteStmt = db.prepare("DELETE FROM forwarded_messages WHERE key = ?");
    }
    if (!selectAllStmt) {
        selectAllStmt = db.prepare("SELECT * FROM forwarded_messages");
    }

    return {
        select: selectStmt,
        insert: insertStmt,
        delete: deleteStmt,
        selectAll: selectAllStmt,
    };
}

export function saveMessage(key: string, mapping: MessageMapping): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { insert } = getStatements(db);
        insert.run(key, mapping["1"] ?? null, mapping["2"] ?? null);
    } catch (err) {
        console.error("Failed to save message mapping:", err);
    }
}

export function getMessage(key: string): MessageMapping | null {
    const db = getDatabase();
    if (!db) return null;

    try {
        const { select } = getStatements(db);
        const row = select.get(key) as
            | { key: string; gc1_id: string | null; gc2_id: string | null }
            | undefined;

        if (!row) return null;

        const mapping: MessageMapping = {};
        if (row.gc1_id) mapping["1"] = row.gc1_id;
        if (row.gc2_id) mapping["2"] = row.gc2_id;

        return mapping;
    } catch (err) {
        console.error("Failed to get message mapping:", err);
        return null;
    }
}

export function deleteMessage(key: string): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { delete: del } = getStatements(db);
        del.run(key);
    } catch (err) {
        console.error("Failed to delete message mapping:", err);
    }
}

export function loadAllMessages(): Map<string, MessageMapping> {
    const db = getDatabase();
    const messages = new Map<string, MessageMapping>();

    if (!db) return messages;

    try {
        const { selectAll } = getStatements(db);
        const rows = selectAll.all() as Array<{
            key: string;
            gc1_id: string | null;
            gc2_id: string | null;
        }>;

        for (const row of rows) {
            const mapping: MessageMapping = {};
            if (row.gc1_id) mapping["1"] = row.gc1_id;
            if (row.gc2_id) mapping["2"] = row.gc2_id;
            messages.set(row.key, mapping);
        }
    } catch (err) {
        console.error("Failed to load messages:", err);
    }

    return messages;
}

export function saveAllMessages(messages: Map<string, MessageMapping>): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { insert } = getStatements(db);
        const transaction = db.transaction(() => {
            for (const [key, mapping] of messages) {
                insert.run(key, mapping["1"] ?? null, mapping["2"] ?? null);
            }
        });
        transaction();
    } catch (err) {
        console.error("Failed to save all messages:", err);
    }
}
