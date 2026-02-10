import type { MessageDataMap } from './types';
import { Client } from 'discord.js-selfbot-v13';

export const client = new Client();
export const startTime = Date.now();

export let isShuttingDown = false;

export function setShuttingDown(value: boolean): void {
    isShuttingDown = value;
}

export const forwardedMessages = new Map<string, MessageDataMap>();
export const lastSender = new Map<string, string>();
export const activeVoiceCalls = new Map<string, string>();
