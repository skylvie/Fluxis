import type { MessageOptions } from "discord.js-selfbot-v13";

/**
 * Application configuration loaded from config.json
 */
export interface Config {
    token: string;
    prefix: string;
    owner_id: string;
    cache_to_file: boolean;
    debug_to_dms: boolean;
    has_nitro: boolean;
    /** Fixed keys to avoid object key ordering issues when persisting */
    gc: {
        1: string;
        2: string;
    };
}

/**
 * String literal type for GC keys to ensure type safety across bridge operations
 */
export type GcKey = "1" | "2";

/**
 * Bidirectional message ID mapping between the two bridged group chats.
 * Both keys point to the same mapping object to enable lookup from either side.
 */
export interface MessageMapping {
    "1"?: string;
    "2"?: string;
}

/**
 * Complete context for a bridge operation, precomputed to avoid repeated lookups
 */
export interface BridgeContext {
    sourceChannelId: string;
    targetChannelId: string;
    sourceGcKey: GcKey;
    targetGcKey: GcKey;
}

/**
 * Options for message forwarding behavior
 */
export interface ForwardOptions {
    showHeader: boolean;
    replyToMessageId?: string;
}

export type { MessageOptions };
