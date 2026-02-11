import type {
    Message,
    MessageReaction,
    PartialMessage,
    PartialMessageReaction,
    PartialUser,
    User,
    VoiceState,
} from "discord.js-selfbot-v13";
import { BridgeService } from "../bridge/bridge.service.js";
import { handleCommand } from "../commands/command-handler.js";
import { getBridgeContext, isOurGc } from "../config/config.js";
import { safeExecute } from "../utils/error-handler.js";
import { setupDmLogging } from "../utils/logger.js";
import { client, initializeCache } from "./client.js";

const bridge = new BridgeService(client);

async function onReady(): Promise<void> {
    console.log(`Logged in as ${client.user?.tag}`);

    setupDmLogging(client);
    initializeCache();

    try {
        await bridge.sendToAllChannels("[SYSTEM] started!");
        console.log("Startup messages sent!");
    } catch (err) {
        console.error("Failed to send startup messages:", err);
    }
}

async function onMessageCreate(message: Message): Promise<void> {
    if (message.author.id === client.user?.id) return;

    const isCommand = await handleCommand(message, client, bridge);
    if (isCommand) return;

    if (!isOurGc(message.channelId)) return;

    bridge.clearLastSender(message.channelId);

    if (message.type !== "DEFAULT" && message.type !== "REPLY") {
        await bridge.handleSystemMessage(message);
        return;
    }

    const content = message.content.toLowerCase();
    if (
        content.includes("clink") ||
        content.includes("clank") ||
        content.includes("clanker") ||
        message.content.includes("🤖")
    ) {
        try {
            await message.reply("whatd you call me");
        } catch (err) {
            console.error("Failed to reply:", err);
        }
    }

    await bridge.forwardMessage(message);
}

async function onMessageDelete(message: Message | PartialMessage): Promise<void> {
    if (!message.channelId || !isOurGc(message.channelId)) return;

    let fullMessage = message as Message;

    if (message.partial) {
        try {
            fullMessage = await message.fetch();
        } catch {
            return;
        }
    }

    await bridge.deleteMessage(fullMessage);
}

async function onMessageUpdate(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
): Promise<void> {
    if (!newMessage.channelId || !isOurGc(newMessage.channelId)) return;

    // Fetch full message data if we only have partial objects
    try {
        if (oldMessage.partial) {
            await oldMessage.fetch();
        }
        if (newMessage.partial) {
            await newMessage.fetch();
        }
    } catch (err) {
        console.error("Failed to fetch messages for update:", err);
        return;
    }

    const oldMsg = oldMessage as Message;
    const newMsg = newMessage as Message;

    // Handle pin state changes separately from content edits
    if (oldMsg.pinned !== newMsg.pinned) {
        if (newMsg.pinned) {
            await bridge.pinMessage(newMsg);
        } else {
            await bridge.unpinMessage(newMsg);
        }
    }

    // Don't forward edits from our own messages (prevents loops)
    if (newMessage.author?.id === client.user?.id) return;

    await bridge.updateMessage(newMsg);
}

async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const channelId = newState.channelId || oldState.channelId;
    if (!channelId || !isOurGc(channelId)) return;

    const wasInCall = oldState.channelId === channelId;
    const isInCall = newState.channelId === channelId;

    // Detect when someone leaves a voice call
    if (wasInCall && !isInCall) {
        // Short delay to ensure Discord's state is settled
        setTimeout(async () => {
            const context = getBridgeContext(channelId);
            if (context) {
                await bridge.handleVoiceCallEnd(channelId);
            }
        }, 1000);
    }
}

async function onMessageReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<void> {
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

    await bridge.addReaction(message.id, message.channelId, emoji);
}

async function onMessageReactionRemove(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
): Promise<void> {
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

    await bridge.removeReaction(message.id, message.channelId, emoji);
}

export function setupEventHandlers(): void {
    client.once("ready", safeExecute(onReady, "onReady"));
    client.on("messageCreate", safeExecute(onMessageCreate, "onMessageCreate"));
    client.on("messageDelete", safeExecute(onMessageDelete, "onMessageDelete"));
    client.on("messageUpdate", safeExecute(onMessageUpdate, "onMessageUpdate"));
    client.on("voiceStateUpdate", safeExecute(onVoiceStateUpdate, "onVoiceStateUpdate"));
    client.on("messageReactionAdd", safeExecute(onMessageReactionAdd, "onMessageReactionAdd"));
    client.on(
        "messageReactionRemove",
        safeExecute(onMessageReactionRemove, "onMessageReactionRemove")
    );
}
