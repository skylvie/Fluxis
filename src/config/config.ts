import * as fs from "node:fs";
import * as path from "node:path";
import type { BridgeContext, Config, GcKey } from "./types.js";

const cfgPath = path.join(process.cwd(), "config.json");

// Fail fast if config is missing - no point continuing without it
if (!fs.existsSync(cfgPath)) {
    console.error("Config file not found!");
    process.exit(1);
}

const raw = fs.readFileSync(cfgPath, "utf-8");
export const config: Config = JSON.parse(raw);

/**
 * Checks if a channel ID belongs to either of the bridged group chats.
 * Used to filter events to only process messages from our target channels.
 */
export function isOurGc(channelId: string): boolean {
    return channelId === config.gc["1"] || channelId === config.gc["2"];
}

/**
 * Maps a channel ID to its GC key ("1" or "2").
 * Returns null if the channel isn't one of our bridged GCs.
 */
export function getGcKey(channelId: string): GcKey | null {
    if (channelId === config.gc["1"]) return "1";
    if (channelId === config.gc["2"]) return "2";
    return null;
}

/**
 * Returns the opposite GC's channel ID for bridging.
 * This is the core routing logic: GC1 messages go to GC2 and vice versa.
 */
export function getOtherGcId(channelId: string): string | null {
    if (channelId === config.gc["1"]) return config.gc["2"];
    if (channelId === config.gc["2"]) return config.gc["1"];
    return null;
}

/**
 * Precomputes all bridge routing information from a source channel ID.
 * Returns null if the channel isn't bridged, avoiding expensive repeated lookups.
 */
export function getBridgeContext(sourceChannelId: string): BridgeContext | null {
    const sourceGcKey = getGcKey(sourceChannelId);
    if (!sourceGcKey) return null;

    const targetGcKey: GcKey = sourceGcKey === "1" ? "2" : "1";
    const targetChannelId = config.gc[targetGcKey];

    return {
        sourceChannelId,
        targetChannelId,
        sourceGcKey,
        targetGcKey,
    };
}

/**
 * Returns attachment size limit based on Nitro status.
 * Discord enforces these limits server-side, so we pre-filter to avoid API errors.
 */
export function getMaxAttachmentSize(): number {
    return config.has_nitro ? 500 * 1024 * 1024 : 10 * 1024 * 1024;
}
