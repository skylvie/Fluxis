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
        console.error('[ERROR] Failed to send to all GCs:', err);
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
        console.error('[ERROR] Failed to send to other GC:', err);
    }
    
    return null;
}

export function getGcKey(channelId: string): GcKey | null {
    if (channelId === config.gc['1']) return '1';
    if (channelId === config.gc['2']) return '2';

    return null;
}
