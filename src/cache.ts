import type { MessageDataMap } from './types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from './config';
import { forwardedMessages, lastSender, activeVoiceCalls } from './state';

const cachePath = path.join(process.cwd(), 'cache.json');

interface CacheData {
    forwardedMessages: Record<string, MessageDataMap>;
    lastSender: Record<string, string>;
    activeVoiceCalls: Record<string, string>;
}

export function loadCache(): void {
    if (!config.cache_to_file) {
        console.log('[CACHE] File caching is disabled');
        return;
    }

    try {
        if (!fs.existsSync(cachePath)) {
            console.log('[CACHE] No cache file found, starting fresh');
            return;
        }

        const raw = fs.readFileSync(cachePath, 'utf-8');
        const data: CacheData = JSON.parse(raw);

        if (data.forwardedMessages) {
            for (const [key, value] of Object.entries(data.forwardedMessages)) {
                forwardedMessages.set(key, value);
            }
        }

        if (data.lastSender) {
            for (const [key, value] of Object.entries(data.lastSender)) {
                lastSender.set(key, value);
            }
        }

        if (data.activeVoiceCalls) {
            for (const [key, value] of Object.entries(data.activeVoiceCalls)) {
                activeVoiceCalls.set(key, value);
            }
        }

        console.log(`[CACHE] Loaded ${forwardedMessages.size} forwarded messages, ${lastSender.size} last senders, ${activeVoiceCalls.size} active voice calls`);
    } catch (err) {
        console.error('[CACHE] Failed to load cache:', err);
    }
}

export function saveCache(): void {
    if (!config.cache_to_file) {
        return;
    }

    try {
        const data: CacheData = {
            forwardedMessages: Object.fromEntries(forwardedMessages),
            lastSender: Object.fromEntries(lastSender),
            activeVoiceCalls: Object.fromEntries(activeVoiceCalls)
        };

        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('[CACHE] Failed to save cache:', err);
    }
}
