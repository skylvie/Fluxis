import type { MessageDataMap } from './types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config';
import { forwardedMessages, lastSender, activeVoiceCalls } from './state';

const dbPath = path.join(process.cwd(), 'cache.db');
const jsonCachePath = path.join(process.cwd(), 'cache.json');

let db: Database.Database | null = null;

interface CacheData {
    forwardedMessages: Record<string, MessageDataMap>;
    lastSender: Record<string, string>;
    activeVoiceCalls: Record<string, string>;
}

function initializeDatabase(): Database.Database {
    const database = new Database(dbPath);
    
    database.pragma('journal_mode = WAL');
    
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
    
    return database;
}

function migrateFromJson(): void {
    if (!fs.existsSync(jsonCachePath)) {
        return;
    }
    
    try {
        console.log('Found cache.json, migrating to SQLite...');
        
        const raw = fs.readFileSync(jsonCachePath, 'utf-8');
        const data: CacheData = JSON.parse(raw);
        
        if (!db) return;
        
        const insertMessage = db.prepare(`
            INSERT OR REPLACE INTO forwarded_messages (key, gc1_id, gc2_id)
            VALUES (?, ?, ?)
        `);
        
        const insertSender = db.prepare(`
            INSERT OR REPLACE INTO last_senders (gc_id, user_id)
            VALUES (?, ?)
        `);
        
        const insertCall = db.prepare(`
            INSERT OR REPLACE INTO active_voice_calls (gc_id, call_id)
            VALUES (?, ?)
        `);
        
        const migrate = db.transaction(() => {
            if (data.forwardedMessages) {
                for (const [key, value] of Object.entries(data.forwardedMessages)) {
                    insertMessage.run(key, value['1'] || null, value['2'] || null);
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

        const backupPath = '.' + jsonCachePath + '.bk';
        fs.renameSync(jsonCachePath, backupPath);
        console.log(`Migration complete! Old cache backed up to ${path.basename(backupPath)}`);
    } catch (err) {
        console.error('Failed to migrate from JSON:', err);
    }
}

export function loadCache(): void {
    if (!config.cache_to_file) {
        console.log('File caching is disabled');
        return;
    }

    try {
        db = initializeDatabase();
        
        migrateFromJson();
        
        const messages = db.prepare('SELECT * FROM forwarded_messages').all() as Array<{
            key: string;
            gc1_id: string | null;
            gc2_id: string | null;
        }>;
        
        for (const row of messages) {
            const messageData: MessageDataMap = {};

            if (row.gc1_id) messageData['1'] = row.gc1_id;
            if (row.gc2_id) messageData['2'] = row.gc2_id;

            forwardedMessages.set(row.key, messageData);
        }
        
        const senders = db.prepare('SELECT * FROM last_senders').all() as Array<{
            gc_id: string;
            user_id: string;
        }>;
        
        for (const row of senders) {
            lastSender.set(row.gc_id, row.user_id);
        }
        
        const calls = db.prepare('SELECT * FROM active_voice_calls').all() as Array<{
            gc_id: string;
            call_id: string;
        }>;
        
        for (const row of calls) {
            activeVoiceCalls.set(row.gc_id, row.call_id);
        }
        
        console.log(`Loaded ${forwardedMessages.size} forwarded messages, ${lastSender.size} last senders, ${activeVoiceCalls.size} active voice calls from SQLite`);
    } catch (err) {
        console.error('Failed to load cache:', err);
    }
}

export function saveCache(): void {
    if (!config.cache_to_file || !db) {
        return;
    }

    try {
        const insertMessage = db.prepare(`
            INSERT OR REPLACE INTO forwarded_messages (key, gc1_id, gc2_id)
            VALUES (?, ?, ?)
        `);
        
        const insertSender = db.prepare(`
            INSERT OR REPLACE INTO last_senders (gc_id, user_id)
            VALUES (?, ?)
        `);
        
        const insertCall = db.prepare(`
            INSERT OR REPLACE INTO active_voice_calls (gc_id, call_id)
            VALUES (?, ?)
        `);
        
        const save = db.transaction(() => {
            for (const [key, value] of forwardedMessages) {
                insertMessage.run(key, value['1'] || null, value['2'] || null);
            }
            
            for (const [gcId, userId] of lastSender) {
                insertSender.run(gcId, userId);
            }
            
            for (const [gcId, callId] of activeVoiceCalls) {
                insertCall.run(gcId, callId);
            }
        });
        
        save();
    } catch (err) {
        console.error('Failed to save cache:', err);
    }
}

export function saveForwardedMessage(key: string, messageData: MessageDataMap): void {
    if (!config.cache_to_file || !db) {
        return;
    }
    
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO forwarded_messages (key, gc1_id, gc2_id)
            VALUES (?, ?, ?)
        `);
        stmt.run(key, messageData['1'] || null, messageData['2'] || null);
    } catch (err) {
        console.error('Failed to save forwarded message:', err);
    }
}

export function deleteForwardedMessage(key: string): void {
    if (!config.cache_to_file || !db) {
        return;
    }
    
    try {
        const stmt = db.prepare('DELETE FROM forwarded_messages WHERE key = ?');
        stmt.run(key);
    } catch (err) {
        console.error('Failed to delete forwarded message:', err);
    }
}

export function saveLastSender(gcId: string, userId: string): void {
    if (!config.cache_to_file || !db) {
        return;
    }
    
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO last_senders (gc_id, user_id)
            VALUES (?, ?)
        `);
        stmt.run(gcId, userId);
    } catch (err) {
        console.error('Failed to save last sender:', err);
    }
}

export function deleteLastSender(gcId: string): void {
    if (!config.cache_to_file || !db) {
        return;
    }
    
    try {
        const stmt = db.prepare('DELETE FROM last_senders WHERE gc_id = ?');
        stmt.run(gcId);
    } catch (err) {
        console.error('Failed to delete last sender:', err);
    }
}

export function saveActiveVoiceCall(gcId: string, callId: string): void {
    if (!config.cache_to_file || !db) {
        return;
    }
    
    try {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO active_voice_calls (gc_id, call_id)
            VALUES (?, ?)
        `);
        stmt.run(gcId, callId);
    } catch (err) {
        console.error('Failed to save active voice call:', err);
    }
}

export function deleteActiveVoiceCall(gcId: string): void {
    if (!config.cache_to_file || !db) {
        return;
    }
    
    try {
        const stmt = db.prepare('DELETE FROM active_voice_calls WHERE gc_id = ?');
        stmt.run(gcId);
    } catch (err) {
        console.error('Failed to delete active voice call:', err);
    }
}

export function closeCache(): void {
    if (db) {
        db.close();
        db = null;
    }
}
