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
        selectStmt = db.prepare("SELECT * FROM active_voice_calls WHERE gc_id = ?");
    }
    if (!insertStmt) {
        insertStmt = db.prepare(`
            INSERT OR REPLACE INTO active_voice_calls (gc_id, call_id)
            VALUES (?, ?)
        `);
    }
    if (!deleteStmt) {
        deleteStmt = db.prepare("DELETE FROM active_voice_calls WHERE gc_id = ?");
    }
    if (!selectAllStmt) {
        selectAllStmt = db.prepare("SELECT * FROM active_voice_calls");
    }

    return {
        select: selectStmt,
        insert: insertStmt,
        delete: deleteStmt,
        selectAll: selectAllStmt,
    };
}

export function saveCall(gcId: string, callId: string): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { insert } = getStatements(db);
        insert.run(gcId, callId);
    } catch (err) {
        console.error("Failed to save voice call:", err);
    }
}

export function getCall(gcId: string): string | null {
    const db = getDatabase();
    if (!db) return null;

    try {
        const { select } = getStatements(db);
        const row = select.get(gcId) as { gc_id: string; call_id: string } | undefined;
        return row?.call_id ?? null;
    } catch (err) {
        console.error("Failed to get voice call:", err);
        return null;
    }
}

export function deleteCall(gcId: string): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { delete: del } = getStatements(db);
        del.run(gcId);
    } catch (err) {
        console.error("Failed to delete voice call:", err);
    }
}

export function loadAllCalls(): Map<string, string> {
    const db = getDatabase();
    const calls = new Map<string, string>();

    if (!db) return calls;

    try {
        const { selectAll } = getStatements(db);
        const rows = selectAll.all() as Array<{ gc_id: string; call_id: string }>;

        for (const row of rows) {
            calls.set(row.gc_id, row.call_id);
        }
    } catch (err) {
        console.error("Failed to load calls:", err);
    }

    return calls;
}

export function saveAllCalls(calls: Map<string, string>): void {
    const db = getDatabase();
    if (!db) return;

    try {
        const { insert } = getStatements(db);
        const transaction = db.transaction(() => {
            for (const [gcId, callId] of calls) {
                insert.run(gcId, callId);
            }
        });
        transaction();
    } catch (err) {
        console.error("Failed to save all calls:", err);
    }
}
