import type { MessageOptions } from './types';
import type { Message, VoiceState } from 'discord.js-selfbot-v13';
import { client, lastSender, activeVoiceCalls } from './state';
import { isOurGc, getOtherGcId, sendToOtherGc, sendToAllGcs, consoleDmFwding } from './utils';
import { handleCommand } from './commands';
import { forwardMessage } from './forwarding';

export function setupEventHandlers(): void {
    client.once('ready', onReady);
    client.on('messageCreate', onMessageCreate);
    client.on('voiceStateUpdate', onVoiceStateUpdate);
}

async function onReady(): Promise<void> {
    console.log(`[DEBUG] Logged in as ${client.user?.tag}`);
    
    // Setup console DM forwarding if enabled
    consoleDmFwding();
    
    try {
        await sendToAllGcs('[SYSTEM] started!');
        console.log('[DEBUG] Startup messages sent!');
    } catch (err) {
        console.error('[ERROR] Failed to send startup messages:', err);
    }
}

async function onMessageCreate(message: Message): Promise<void> {
    if (!isOurGc(message.channelId)) return;
    if (message.author.id === client.user?.id) return;
    
    const otherGcId = getOtherGcId(message.channelId);
    if (!otherGcId) return;
    
    lastSender.delete(message.channelId);

    if (message.type !== 'DEFAULT' && message.type !== 'REPLY') {
        await handleSystemMessage(message);
        return;
    }

    const isCommand = await handleCommand(message);
    if (isCommand) return;
    
    await forwardMessage(message, otherGcId);
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
                }

                return;
        }
        
        if (systemMessage) {
            await sendToOtherGc(message.channelId, systemMessage);
        }
    } catch (err) {
        console.error('[ERROR] Failed to handle system message:', err);
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
                        console.error('[ERROR] Failed to send VC ended message:', err);
                    }
                }
                
                activeVoiceCalls.delete(channelId);
            }, 1000);
        }
    }
}
