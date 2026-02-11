import type { MessageOptions } from './types';
import type {
    Message,
    VoiceState,
    PartialMessage,
    MessageReaction,
    User,
    PartialMessageReaction,
    PartialUser
} from 'discord.js-selfbot-v13';
import { client, lastSender, activeVoiceCalls } from './state';
import {
    isOurGc,
    getOtherGcId,
    sendToOtherGc,
    sendToAllGcs,
    consoleDmFwding
} from './utils';
import { handleCommand } from './commands';
import { 
    forwardMessage, 
    deleteForwardedMessage, 
    updateForwardedMessage, 
    pinForwardedMessage, 
    unpinForwardedMessage,
    addReactionToForwardedMessage,
    removeReactionFromForwardedMessage
} from './forwarding';
import { loadCache,
    deleteLastSender,
    saveActiveVoiceCall,
    deleteActiveVoiceCall
} from './cache';

export function setupEventHandlers(): void {
    client.once('ready', onReady);
    client.on('messageCreate', onMessageCreate);
    client.on('messageDelete', onMessageDelete);
    client.on('messageUpdate', onMessageUpdate);
    client.on('voiceStateUpdate', onVoiceStateUpdate);
    client.on('messageReactionAdd', onMessageReactionAdd);
    client.on('messageReactionRemove', onMessageReactionRemove);
}

async function onReady(): Promise<void> {
    console.log(`Logged in as ${client.user?.tag}`);
    consoleDmFwding();

    loadCache();

    try {
        await sendToAllGcs('[SYSTEM] started!');
        console.log('Startup messages sent!');
    } catch (err) {
        console.error('Failed to send startup messages:', err);
    }
}

async function onMessageCreate(message: Message): Promise<void> {
    if (message.author.id === client.user?.id) return;


    const isCommand = await handleCommand(message);
    if (isCommand) return;

    if (!isOurGc(message.channelId)) return;

    const otherGcId = getOtherGcId(message.channelId);
    if (!otherGcId) return;

    lastSender.delete(message.channelId);
    deleteLastSender(message.channelId);

    if (message.type !== 'DEFAULT' && message.type !== 'REPLY') {
        await handleSystemMessage(message);
        return;
    }

    const content = message.content.toLowerCase();
    if (
        content.includes('clink') ||
        content.includes('clank') ||
        content.includes('clanker') ||
        message.content.includes('🤖')
    ) {
        try {
            await message.reply('whatd you call me');
        } catch (err) {
            console.error('Failed to reply:', err);
        }
    }

    await forwardMessage(message, otherGcId);
}

async function onMessageDelete(message: Message | PartialMessage): Promise<void> {
    if (!message.channelId || !isOurGc(message.channelId)) return;

    if (message.partial) {
        try {
            await message.fetch();
        } catch {
            return;
        }
    }

    await deleteForwardedMessage(message as Message);
}

async function onMessageUpdate(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
): Promise<void> {
    if (!newMessage.channelId || !isOurGc(newMessage.channelId)) return;

    try {
        if (oldMessage.partial) {
            await oldMessage.fetch();
        }
        if (newMessage.partial) {
            await newMessage.fetch();
        }
    } catch (err) {
        console.error('Failed to fetch messages for update:', err);
        return;
    }

    const oldMsg = oldMessage as Message;
    const newMsg = newMessage as Message;

    if (oldMsg.pinned !== newMsg.pinned) {
        if (newMsg.pinned) {
            await pinForwardedMessage(newMsg);
        } else {
            await unpinForwardedMessage(newMsg);
        }
    }

    if (newMessage.author?.id === client.user?.id) return;

    await updateForwardedMessage(newMsg);
}

async function handleSystemMessage(message: Message): Promise<void> {
    try {
        const authorName = message.author.displayName || message.author.username;
        let systemMessage = '';

        switch (message.type) {
            case 'CHANNEL_NAME_CHANGE':
                if (message.content) {
                    systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) changed the other GC title to: ${message.content}`;
                }

                break;

            case 'CHANNEL_ICON_CHANGE':
                systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) changed the other GC icon`;
                break;

            case 'RECIPIENT_ADD':
                if (message.mentions.users.size > 0) {
                    const addedUser = message.mentions.users.first();

                    if (addedUser) {
                        const addedName = addedUser.displayName || addedUser.username;
                        systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) added ${addedName} (<@${addedUser.id}>) to the other GC`;
                    }
                }
                break;

            case 'RECIPIENT_REMOVE':
                if (message.mentions.users.size > 0) {
                    const removedUser = message.mentions.users.first();

                    if (removedUser) {
                        const removedName = removedUser.displayName || removedUser.username;

                        if (removedUser.id === message.author.id) {
                            systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) left the other GC`;
                        } else {
                            systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) removed ${removedName} (<@${removedUser.id}>) from the other GC`;
                        }
                    }
                }
                break;

            case 'CALL':
                systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) started a VC`;

                const sentMessage = await sendToOtherGc(message.channelId, systemMessage);
                if (sentMessage) {
                    activeVoiceCalls.set(message.channelId, sentMessage.id);
                    saveActiveVoiceCall(message.channelId, sentMessage.id);
                }

                return;
        }

        if (systemMessage) {
            await sendToOtherGc(message.channelId, systemMessage);
        }
    } catch (err) {
        console.error('Failed to handle system message:', err);
    }
}

async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const channelId = newState.channelId || oldState.channelId;
    if (!channelId || !isOurGc(channelId)) return;

    const wasInCall = oldState.channelId === channelId;
    const isInCall = newState.channelId === channelId;

    if (wasInCall && !isInCall) {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const vcMessageId = activeVoiceCalls.get(channelId);
        if (vcMessageId) {
            setTimeout(async () => {
                const otherGcId = getOtherGcId(channelId);
                if (otherGcId) {
                    try {
                        const otherChannel = await client.channels.fetch(otherGcId);
                        if (otherChannel?.isText()) {
                            const replyOptions: MessageOptions = {
                                content: '[SYSTEM] VC has ended',
                                reply: { messageReference: vcMessageId }
                            };

                            await otherChannel.send(replyOptions);
                        }
                    } catch (err) {
                        console.error('Failed to send VC ended message:', err);
                    }
                }

                activeVoiceCalls.delete(channelId);
                deleteActiveVoiceCall(channelId);
            }, 1000);
        }
    }
}

async function onMessageReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<void> {
    try {
        if (user.id === client.user?.id) return;
        
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch {
                return;
            }
        }
        
        const message = reaction.message;
        if (!message.channelId || !isOurGc(message.channelId)) return;
        
        const emoji = reaction.emoji.id ? reaction.emoji.identifier : reaction.emoji.name;
        if (!emoji) return;
        
        await addReactionToForwardedMessage(message.id, message.channelId, emoji);
    } catch (err) {
        console.error('Failed to handle reaction add:', err);
    }
}

async function onMessageReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<void> {
    try {
        if (user.id === client.user?.id) return;
        
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch {
                return;
            }
        }
        
        const message = reaction.message;
        if (!message.channelId || !isOurGc(message.channelId)) return;
        
        const emoji = reaction.emoji.id ? reaction.emoji.identifier : reaction.emoji.name;
        if (!emoji) return;
        
        await removeReactionFromForwardedMessage(message.id, message.channelId, emoji);
    } catch (err) {
        console.error('Failed to handle reaction remove:', err);
    }
}
