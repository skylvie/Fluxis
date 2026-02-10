import type { MessageOptions, GcKey } from './types';
import type { Message } from 'discord.js-selfbot-v13';
import { config } from './config';
import { client, forwardedMessages, lastSender } from './state';
import { getDisplayName } from './utils';
import { saveCache } from './cache';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export async function forwardMessage(message: Message, otherGcId: string): Promise<void> {
    try {
        const otherChannel = await client.channels.fetch(otherGcId);
        if (!otherChannel?.isText()) return;
        
        const isForwardedMessage = message.reference?.messageId && 
            !message.content && 
            message.attachments.size === 0 && 
            message.embeds.length === 0 &&
            message.stickers.size === 0;
        
        if (isForwardedMessage) {
            try {
                if (!message.reference?.channelId || !message.reference?.messageId) {
                    throw new Error('Missing reference data');
                }
                
                const refChannel = await client.channels.fetch(message.reference.channelId);

                if (refChannel?.isText()) {
                    const referencedMsg = await refChannel.messages.fetch(message.reference.messageId);
                    const displayName = getDisplayName(message);
                    const forwardHeader = `-# ${displayName} (<@${message.author.id}>) forwarded a message:`;
                    
                    await otherChannel.send(forwardHeader);
                    await referencedMsg.forward(otherChannel);
                    lastSender.set(otherGcId, message.author.id);
                }
            } catch (err) {
                const displayName = getDisplayName(message);
                const systemMessage = `[SYSTEM] ${displayName} (<@${message.author.id}>) forwarded a message from another channel`;

                await otherChannel.send(systemMessage);
            }
            return;
        }
        
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
            const largeAttachmentLinks: string[] = [];
            
            if (content) {
                messageOptions.content = content;
            }
            
            if (replyToMessageId) {
                messageOptions.reply = { messageReference: replyToMessageId };
            }
            
            if (message.attachments.size > 0) {
                const validAttachments = [];
                
                for (const attachment of message.attachments.values()) {
                    if (attachment.size > MAX_ATTACHMENT_SIZE) {
                        largeAttachmentLinks.push(`[Attachment too large (${(attachment.size / (1024 * 1024)).toFixed(2)} MB)]: ${attachment.url}`);
                    } else {
                        validAttachments.push(attachment);
                    }
                }
                
                if (validAttachments.length > 0) {
                    messageOptions.files = validAttachments;
                }
            }
            
            if (largeAttachmentLinks.length > 0) {
                const linkText = largeAttachmentLinks.join('\n');

                messageOptions.content = messageOptions.content 
                    ? `${messageOptions.content}\n${linkText}`
                    : linkText;
            }
            
            if (message.embeds.length > 0) {
                messageOptions.embeds = message.embeds;
            }
            
            if (message.stickers.size > 0) {
                messageOptions.stickers = Array.from(message.stickers.keys());
            }
            
            const hasContent = messageOptions.content || 
                (messageOptions.files && messageOptions.files.length > 0) ||
                (messageOptions.embeds && messageOptions.embeds.length > 0) ||
                (messageOptions.stickers && messageOptions.stickers.length > 0);
            
            if (!hasContent) {
                console.warn('Skipping empty message forward from', message.channelId, 'to', otherGcId);
                return;
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
            saveCache();
        }
    } catch (err) {
        console.error('Failed to forward message from', message.channelId, 'to', otherGcId, ':', err);
    }
}

export async function deleteForwardedMessage(message: Message): Promise<void> {
    try {
        const messageData = forwardedMessages.get(message.id);
        if (!messageData) return;
        
        const currentGcKey: GcKey = message.channelId === config.gc['1'] ? '1' : '2';
        const otherGcKey: GcKey = currentGcKey === '1' ? '2' : '1';
        const otherGcId = config.gc[otherGcKey];
        
        const otherMessageId = messageData[otherGcKey];
        if (!otherMessageId) return;
        
        const otherChannel = await client.channels.fetch(otherGcId);

        if (otherChannel?.isText()) {
            try {
                const messageToDelete = await otherChannel.messages.fetch(otherMessageId);
                await messageToDelete.delete();
            } catch (err: any) {
                if (err?.code !== 10008) {
                    throw err;
                }
            }
            
            forwardedMessages.delete(message.id);
            forwardedMessages.delete(otherMessageId);
            saveCache();
        }
    } catch (err) {
        console.error('Failed to delete forwarded message:', err);
    }
}

export async function updateForwardedMessage(newMessage: Message): Promise<void> {
    try {
        const messageData = forwardedMessages.get(newMessage.id);
        if (!messageData) return;
        
        const currentGcKey: GcKey = newMessage.channelId === config.gc['1'] ? '1' : '2';
        const otherGcKey: GcKey = currentGcKey === '1' ? '2' : '1';
        const otherGcId = config.gc[otherGcKey];
        
        const otherMessageId = messageData[otherGcKey];
        if (!otherMessageId) return;
        
        const otherChannel = await client.channels.fetch(otherGcId);
        if (!otherChannel?.isText()) return;
        
        const messageToEdit = await otherChannel.messages.fetch(otherMessageId);
        
        const displayName = getDisplayName(newMessage);
        const originalContent = messageToEdit.content || '';
        
        const hasHeader = originalContent.startsWith('-#');
        let newContent = '';
        
        if (hasHeader) {
            const headerMatch = originalContent.match(/^-# .+? said:\n?/);
            if (headerMatch) {
                const header = headerMatch[0];
                newContent = header + (newMessage.content || '');
            } else {
                newContent = `-# ${displayName} (<@${newMessage.author.id}>) said:\n${newMessage.content || ''}`;
            }
        } else {
            newContent = newMessage.content || '';
        }
        
        const largeAttachmentLinks: string[] = [];
        const validAttachments = [];
        
        if (newMessage.attachments.size > 0) {
            for (const attachment of newMessage.attachments.values()) {
                if (attachment.size > MAX_ATTACHMENT_SIZE) {
                    largeAttachmentLinks.push(`[Attachment too large (${(attachment.size / (1024 * 1024)).toFixed(2)} MB)]: ${attachment.url}`);
                } else {
                    validAttachments.push(attachment);
                }
            }
        }
        
        if (largeAttachmentLinks.length > 0) {
            newContent += '\n' + largeAttachmentLinks.join('\n');
        }
        
        await messageToEdit.edit(newContent || ' ');
    } catch (err) {
        console.error('Failed to update forwarded message:', err);
    }
}

export async function pinForwardedMessage(message: Message): Promise<void> {
    try {
        const messageData = forwardedMessages.get(message.id);
        if (!messageData) return;
        
        const currentGcKey: GcKey = message.channelId === config.gc['1'] ? '1' : '2';
        const otherGcKey: GcKey = currentGcKey === '1' ? '2' : '1';
        const otherGcId = config.gc[otherGcKey];
        
        const otherMessageId = messageData[otherGcKey];
        if (!otherMessageId) return;
        
        const otherChannel = await client.channels.fetch(otherGcId);
        if (!otherChannel?.isText()) return;
        
        const messageToPin = await otherChannel.messages.fetch(otherMessageId);
        
        if (!messageToPin.pinned) {
            await messageToPin.pin();
        }
    } catch (err) {
        console.error('Failed to pin forwarded message:', err);
    }
}

export async function unpinForwardedMessage(message: Message): Promise<void> {
    try {
        const messageData = forwardedMessages.get(message.id);
        if (!messageData) return;
        
        const currentGcKey: GcKey = message.channelId === config.gc['1'] ? '1' : '2';
        const otherGcKey: GcKey = currentGcKey === '1' ? '2' : '1';
        const otherGcId = config.gc[otherGcKey];
        
        const otherMessageId = messageData[otherGcKey];
        if (!otherMessageId) return;
        
        const otherChannel = await client.channels.fetch(otherGcId);
        if (!otherChannel?.isText()) return;
        
        const messageToUnpin = await otherChannel.messages.fetch(otherMessageId);
        
        if (messageToUnpin.pinned) {
            await messageToUnpin.unpin();
        }
    } catch (err) {
        console.error('Failed to unpin forwarded message:', err);
    }
}
