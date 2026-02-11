import type Database from "better-sqlite3";
import { getDatabase } from "../database.js";

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
        selectStmt = db.prepare("SELECT * FROM last_senders WHERE gc_id = ?");
    }
    if (!insertStmt) {
        insertStmt = db.prepare(`
            INSERT OR REPLACE INTO last_senders (gc_id, user_id)
            VALUES (?, ?)
        `);
    }
    if (!deleteStmt) {
        deleteStmt = db.prepare("DELETE FROM last_senders WHERE gc_id = ?");
    }
    if (!selectAllStmt) {
        selectAllStmt = db.prepare("SELECT * FROM last_senders");
    }

    return {
        select: selectStmt,
        insert: insertStmt,
        delete: deleteStmt,
        selectAll: selectAllStmt,
    };
}

export function saveSender(gcId: string, userId: string): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { insert } = getStatements(db);
        insert.run(gcId, userId);
    } catch (err) {
        console.error("Failed to save last sender:", err);
    }
}

export function getSender(gcId: string): string | null {
    const db = getDatabase();
    if (!db) return null;

    try {
        const { select } = getStatements(db);
        const row = select.get(gcId) as { gc_id: string; user_id: string } | undefined;
        return row?.user_id ?? null;
    } catch (err) {
        console.error("Failed to get last sender:", err);
        return null;
    }
}

export function deleteSender(gcId: string): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { delete: del } = getStatements(db);
        del.run(gcId);
    } catch (err) {
        console.error("Failed to delete last sender:", err);
    }
}

export function loadAllSenders(): Map<string, string> {
    const db = getDatabase();
    const senders = new Map<string, string>();

    if (!db) return senders;

    try {
        const { selectAll } = getStatements(db);
        const rows = selectAll.all() as Array<{ gc_id: string; user_id: string }>;

        for (const row of rows) {
            senders.set(row.gc_id, row.user_id);
        }
    } catch (err) {
        console.error("Failed to load senders:", err);
    }

    return senders;
}

export function saveAllSenders(senders: Map<string, string>): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { insert } = getStatements(db);
        const transaction = db.transaction(() => {
            for (const [gcId, userId] of senders) {
                insert.run(gcId, userId);
            }
        });
        transaction();
    } catch (err) {
        console.error("Failed to save all senders:", err);
    }
}
