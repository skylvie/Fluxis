import type { GcKey } from './types';
import type { Message } from 'discord.js-selfbot-v13';
import { config } from './config';
import { client } from './state';

export function getOtherGcId(currGcId: string): string | null {
    if (currGcId === config.gc['1']) return config.gc['2'];
    if (currGcId === config.gc['2']) return config.gc['1'];

    return null;
}

export function getDisplayName(message: Message): string {
    return message.member?.displayName || 
        message.author.displayName || 
        message.author.username;
}

export function isOurGc(channelId: string): boolean {
    return channelId === config.gc['1'] ||
        channelId === config.gc['2'];
}

export async function sendToAllGcs(content: string): Promise<void> {
    try {
        const gc1 = await client.channels.fetch(config.gc['1']);
        const gc2 = await client.channels.fetch(config.gc['2']);
        
        if (gc1?.isText()) await gc1.send(content);
        if (gc2?.isText()) await gc2.send(content);
    } catch (err) {
        console.error('Failed to send to all GCs:', err);
    }
}

export async function sendToOtherGc(
    currGcId: string,
    content: string
): Promise<Message | null> {
    const otherGcId = getOtherGcId(currGcId);
    if (!otherGcId) return null;
    
    try {
        const channel = await client.channels.fetch(otherGcId);

        if (channel?.isText()) {
            return await channel.send(content);
        }
    } catch (err) {
        console.error('Failed to send to other GC:', err);
    }
    
    return null;
}

export function getGcKey(channelId: string): GcKey | null {
    if (channelId === config.gc['1']) return '1';
    if (channelId === config.gc['2']) return '2';

    return null;
}

const ogConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

async function sendDmToOwner(message: string): Promise<void> {
    if (!config.debug_to_dms) return;
    
    try {
        const owner = await client.users.fetch(config.owner_id);
        if (!owner) {
            ogConsole.error('Failed to fetch owner user');
            return;
        }
        
        const dmChannel = await owner.createDM();
        if (!dmChannel) {
            ogConsole.error('Failed to create DM channel');
            return;
        }
        
        const truncatedMessage = message.length > 1900 
            ? message.substring(0, 1900) + '...' 
            : message;
        
        await dmChannel.send(`\`\`\`\n${truncatedMessage}\n\`\`\``);
    } catch (err) {
        ogConsole.error('Failed to send DM:', err);
    }
}

export function consoleDmFwding(): void {
    if (!config.debug_to_dms) return;
    
    console.log = (...args: any[]) => {
        ogConsole.log(...args);
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        sendDmToOwner(`${message}`).catch(() => {});
    };
    
    console.error = (...args: any[]) => {
        ogConsole.error(...args);
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        sendDmToOwner(`${message}`).catch(() => {});
    };
    
    console.warn = (...args: any[]) => {
        ogConsole.warn(...args);
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        sendDmToOwner(`[WARN] ${message}`).catch(() => {});
    };
    
    console.info = (...args: any[]) => {
        ogConsole.info(...args);
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        sendDmToOwner(`[INFO] ${message}`).catch(() => {});
    };
}
