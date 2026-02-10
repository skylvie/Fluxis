import type { MessageOptions, GcKey } from './types';
import type { Message } from 'discord.js-selfbot-v13';
import { config } from './config';
import { client, forwardedMessages, lastSender } from './state';
import { getDisplayName } from './utils';

export async function forwardMessage(message: Message, otherGcId: string): Promise<void> {
    try {
        const otherChannel = await client.channels.fetch(otherGcId);
        if (!otherChannel?.isText()) return;
        
        const displayName = getDisplayName(message);
        const shouldShowHeader = lastSender.get(otherGcId) !== message.author.id;
        const headerText = shouldShowHeader ? `-# ${displayName} (<@${message.author.id}>) said:` : '';
        
        lastSender.set(otherGcId, message.author.id);
        
        let replyToMessageId: string | undefined;

        if (message.reference?.messageId) {
            const forwardData = forwardedMessages.get(message.reference.messageId);

            if (forwardData) {
                const otherGcKey: GcKey = otherGcId === config.gc['1'] ? '1' : '2';
                replyToMessageId = forwardData[otherGcKey];
            }
        }
        
        const isPoll = message.poll !== null && message.poll !== undefined;
        const isVoiceMessage = message.attachments.size > 0 && 
            message.attachments.first()?.contentType?.includes('audio/ogg');
        
        let sentMessage;
        
        if (isPoll) {
            const pollSystemMessage = `[SYSTEM] ${displayName} (<@${message.author.id}>) created a poll in the other GC`;
            const messageOptions: MessageOptions = { content: pollSystemMessage };
            
            if (replyToMessageId) {
                messageOptions.reply = { messageReference: replyToMessageId };
            }
            
            sentMessage = await otherChannel.send(messageOptions);
        } else if (isVoiceMessage) {
            if (headerText) {
                const headerOptions: MessageOptions = { content: headerText };

                if (replyToMessageId) {
                    headerOptions.reply = { messageReference: replyToMessageId };
                }

                await otherChannel.send(headerOptions);
            }
            
            const messageOptions: MessageOptions = {};
            
            if (message.attachments.size > 0) {
                messageOptions.files = Array.from(message.attachments.values());
            }
            
            sentMessage = await otherChannel.send(messageOptions);
        } else {
            let content = headerText 
                ? headerText + (message.content ? `\n${message.content}` : '')
                : message.content || '';
            
            const messageOptions: MessageOptions = {};
            
            if (content) {
                messageOptions.content = content;
            }
            
            if (replyToMessageId) {
                messageOptions.reply = { messageReference: replyToMessageId };
            }
            
            if (message.attachments.size > 0) {
                messageOptions.files = Array.from(message.attachments.values());
            }
            
            if (message.embeds.length > 0) {
                messageOptions.embeds = message.embeds;
            }
            
            if (message.stickers.size > 0) {
                messageOptions.stickers = Array.from(message.stickers.keys());
            }
            
            sentMessage = await otherChannel.send(messageOptions);
        }
        
        if (sentMessage) {
            const currentGcKey: GcKey = message.channelId === config.gc['1'] ? '1' : '2';
            const otherGcKey: GcKey = otherGcId === config.gc['1'] ? '1' : '2';
            
            const messageData = {
                [currentGcKey]: message.id,
                [otherGcKey]: sentMessage.id
            };
            
            forwardedMessages.set(message.id, messageData);
            forwardedMessages.set(sentMessage.id, messageData);
        }
    } catch (err) {
        console.error('[ERROR] Failed to forward message from', message.channelId, 'to', otherGcId, ':', err);
    }
}
