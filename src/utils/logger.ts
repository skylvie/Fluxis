import type { Client } from "discord.js-selfbot-v13";
import { config } from "../config/config.js";

// Preserve original console methods before we override them
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
};

/**
 * Sends log messages to the bot owner via DM for remote debugging.
 * Useful when running the selfbot on a remote server without direct console access.
 */
async function sendDmToOwner(client: Client, message: string): Promise<void> {
    if (!config.debug_to_dms) return;

    try {
        const owner = await client.users.fetch(config.owner_id);
        const dmChannel = await owner.createDM();

        // Discord has a 2000 char limit; truncate to avoid API errors
        const truncatedMessage =
            message.length > 1900 ? `${message.substring(0, 1900)}...` : message;

        await dmChannel.send(`\`\`\`\n${truncatedMessage}\n\`\`\``);
    } catch (err) {
        originalConsole.error("Failed to send DM:", err);
    }
}

/**
 * Overrides global console methods to mirror logs to Discord DMs.
 * Only activated if debug_to_dms is enabled in config.
 *
 * All logs still go to stdout/stderr, this just adds DM forwarding on top.
 */
export function setupDmLogging(client: Client): void {
    if (!config.debug_to_dms) {
        console.log("DM logging disabled");
        return;
    }

    console.log = (...args: unknown[]) => {
        originalConsole.log(...args);
        const message = args
            .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
            .join(" ");
        void sendDmToOwner(client, message);
    };

    console.error = (...args: unknown[]) => {
        originalConsole.error(...args);
        const message = args
            .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
            .join(" ");
        void sendDmToOwner(client, `ERROR: ${message}`);
    };

    console.warn = (...args: unknown[]) => {
        originalConsole.warn(...args);
        const message = args
            .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
            .join(" ");
        void sendDmToOwner(client, `[WARN] ${message}`);
    };

    console.info = (...args: unknown[]) => {
        originalConsole.info(...args);
        const message = args
            .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
            .join(" ");
        void sendDmToOwner(client, `[INFO] ${message}`);
    };

    console.log("DM logging enabled");
}

export { originalConsole };
