import type { MessageOptions, MessageEmbed } from 'discord.js-selfbot-v13';

export interface Config {
    token: string;
    prefix: string;
    owner_id: string;
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
