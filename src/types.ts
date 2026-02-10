import type { MessageOptions } from 'discord.js-selfbot-v13';

export interface Config {
    token: string;
    prefix: string;
    owner_id: string;
    debug_to_dms: boolean;
    gc: {
        1: string;
        2: string;
    };
}

export type { MessageOptions };

export interface MessageDataMap {
    [key: string]: string;
}

export type GcKey = '1' | '2';
