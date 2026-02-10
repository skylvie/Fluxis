import type { MessageOptions } from 'discord.js-selfbot-v13';

export interface Config {
    token: string;
    prefix: string;
    owner_id: string;
    cache_to_file: boolean;
    debug_to_dms: boolean;
    has_nitro: boolean;
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
