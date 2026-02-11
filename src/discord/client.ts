import { Client } from "discord.js-selfbot-v13";
import { messageMapper } from "../bridge/message-mapper.js";
import { closeDatabase, initializeDatabase } from "../db/database.js";

export const client = new Client();
export const startTime = Date.now();

let isShuttingDown = false;

export function getShuttingDown(): boolean {
    return isShuttingDown;
}

export function setShuttingDown(value: boolean): void {
    isShuttingDown = value;
}

/**
 * Loads cache from SQLite on startup.
 * Must be called after Discord client is ready to avoid race conditions.
 */
export function initializeCache(): void {
    initializeDatabase();
    messageMapper.load();
}

/**
 * Persists current state to SQLite.
 * Called on graceful shutdown or on-demand for certain commands.
 */
export function saveCache(): void {
    messageMapper.saveAll();
}

/**
 * Shutdown sequence: persist state then close database handles.
 */
export function cleanup(): void {
    saveCache();
    closeDatabase();
}
