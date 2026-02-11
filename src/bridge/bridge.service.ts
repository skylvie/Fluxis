import type { Client, Message, TextChannel } from "discord.js-selfbot-v13";
import { getBridgeContext, getMaxAttachmentSize } from "../config/config.js";
import type { BridgeContext, MessageOptions } from "../config/types.js";
import { getDisplayName, isForwardedMessage, isPoll, isVoiceMessage } from "../utils/helpers.js";
import { messageMapper } from "./message-mapper.js";

/**
 * Core bridge logic for forwarding messages between two Discord group chats.
 *
 * Handles all message types: text, attachments, embeds, stickers, polls, voice messages,
 * forwards, edits, deletes, pins, and reactions. Maintains bidirectional mappings to
 * enable operations from either side of the bridge.
 */
export class BridgeService {
    constructor(private client: Client) {}

    private async getChannel(channelId: string): Promise<TextChannel | null> {
        try {
            const channel = await this.client.channels.fetch(channelId);
            return channel?.isText() ? (channel as TextChannel) : null;
        } catch (err: any) {
            // Suppress "Missing Access" errors - these are expected when forwarding from inaccessible channels
            if (err?.code !== 50001) {
                console.error(`Failed to fetch channel ${channelId}:`, err);
            }
            return null;
        }
    }

    /**
     * Determines if we should show author header.
     * Only shown when sender changes to reduce visual clutter.
     */
    private shouldShowHeader(targetChannelId: string, authorId: string): boolean {
        return messageMapper.getLastSender(targetChannelId) !== authorId;
    }

    /**
     * Resolves reply target from bidirectional mapping.
     * If source message was a reply, finds the corresponding forwarded message in target GC.
     */
    private getReplyTarget(message: Message, context: BridgeContext): string | undefined {
        if (!message.reference?.messageId) return undefined;

        const mapping = messageMapper.getMapping(message.reference.messageId);
        return mapping?.[context.targetGcKey];
    }

    async forwardMessage(message: Message): Promise<void> {
        const context = getBridgeContext(message.channelId);
        if (!context) return;

        const targetChannel = await this.getChannel(context.targetChannelId);
        if (!targetChannel) return;

        try {
            // Route to specialized handler based on message type
            if (isForwardedMessage(message)) {
                await this.handleForwardedMessage(message, targetChannel, context);
                return;
            }

            if (isPoll(message)) {
                await this.handlePoll(message, targetChannel, context);
                return;
            }

            if (isVoiceMessage(message)) {
                await this.handleVoiceMessage(message, targetChannel, context);
                return;
            }

            await this.handleRegularMessage(message, targetChannel, context);
        } catch (err) {
            console.error(`Failed to forward message:`, err);
        }
    }

    private async handleForwardedMessage(
        message: Message,
        targetChannel: TextChannel,
        context: BridgeContext
    ): Promise<void> {
        try {
            if (!message.reference?.channelId || !message.reference?.messageId) {
                throw new Error("Missing reference data");
            }

            const refChannel = await this.getChannel(message.reference.channelId);
            if (!refChannel) {
                const displayName = getDisplayName(message);

                await targetChannel.send(
                    `[SYSTEM] ${displayName} (<@${message.author.id}>) forwarded a message from an inaccessible channel`
                );

                return;
            }

            const referencedMsg = await refChannel.messages.fetch(message.reference.messageId);
            const displayName = getDisplayName(message);
            const originalAuthor = getDisplayName(referencedMsg);
            const options: MessageOptions = {
                content: `-# ${displayName} (<@${message.author.id}>) forwarded a message from ${originalAuthor}:`,
            };

            if (referencedMsg.content) {
                options.content += `\n${referencedMsg.content}`;
            }
            if (referencedMsg.attachments.size > 0) {
                options.files = Array.from(referencedMsg.attachments.values());
            }
            if (referencedMsg.embeds.length > 0) {
                options.embeds = referencedMsg.embeds;
            }
            if (referencedMsg.stickers.size > 0) {
                options.stickers = Array.from(referencedMsg.stickers.keys());
            }

            const sent = await targetChannel.send(options);

            messageMapper.saveMapping(
                message.id,
                sent.id,
                context.sourceGcKey,
                context.targetGcKey
            );
            messageMapper.setLastSender(context.targetChannelId, message.author.id);
        } catch (err) {
            console.error("Unexpected error in handleForwardedMessage:", err);

            const displayName = getDisplayName(message);
            await targetChannel.send(
                `[SYSTEM] ${displayName} (<@${message.author.id}>) forwarded a message (error occurred)`
            );
        }
    }

    private async handlePoll(
        message: Message,
        targetChannel: TextChannel,
        context: BridgeContext
    ): Promise<void> {
        const displayName = getDisplayName(message);
        const options: MessageOptions = {
            content: `[SYSTEM] ${displayName} (<@${message.author.id}>) created a poll in the other GC`,
        };
        const replyId = this.getReplyTarget(message, context);

        if (replyId) {
            options.reply = { messageReference: replyId };
        }

        const sent = await targetChannel.send(options);
        messageMapper.saveMapping(message.id, sent.id, context.sourceGcKey, context.targetGcKey);
    }

    private async handleVoiceMessage(
        message: Message,
        targetChannel: TextChannel,
        context: BridgeContext
    ): Promise<void> {
        const showHeader = this.shouldShowHeader(context.targetChannelId, message.author.id);
        const replyId = this.getReplyTarget(message, context);

        if (showHeader) {
            const displayName = getDisplayName(message);
            const headerOptions: MessageOptions = {
                content: `-# ${displayName} (<@${message.author.id}>) said:`,
            };

            if (replyId) {
                headerOptions.reply = { messageReference: replyId };
            }

            await targetChannel.send(headerOptions);
        }

        const options: MessageOptions = {
            files: Array.from(message.attachments.values()),
        };

        const sent = await targetChannel.send(options);

        messageMapper.saveMapping(message.id, sent.id, context.sourceGcKey, context.targetGcKey);
        messageMapper.setLastSender(context.targetChannelId, message.author.id);
    }

    private async handleRegularMessage(
        message: Message,
        targetChannel: TextChannel,
        context: BridgeContext
    ): Promise<void> {
        const showHeader = this.shouldShowHeader(context.targetChannelId, message.author.id);
        const displayName = getDisplayName(message);
        const headerText = showHeader ? `-# ${displayName} (<@${message.author.id}>) said:` : "";

        const options: MessageOptions = {};
        const replyId = this.getReplyTarget(message, context);

        if (replyId) {
            options.reply = { messageReference: replyId };
        }

        let content = headerText;
        if (message.content) {
            content = content ? `${content}\n${message.content}` : message.content;
        }

        const maxSize = getMaxAttachmentSize();
        const validAttachments = [];
        const largeAttachmentLinks: string[] = [];

        for (const attachment of message.attachments.values()) {
            if (attachment.size > maxSize) {
                const sizeMb = (attachment.size / (1024 * 1024)).toFixed(2);
                largeAttachmentLinks.push(
                    `[Attachment too large (${sizeMb} MB)]: ${attachment.url}`
                );
            } else {
                validAttachments.push(attachment);
            }
        }

        if (largeAttachmentLinks.length > 0) {
            content += `\n${largeAttachmentLinks.join("\n")}`;
        }

        if (content) options.content = content;
        if (validAttachments.length > 0) options.files = validAttachments;
        if (message.embeds.length > 0) options.embeds = message.embeds;
        if (message.stickers.size > 0) options.stickers = Array.from(message.stickers.keys());

        const hasContent =
            options.content ||
            options.files?.length ||
            options.embeds?.length ||
            options.stickers?.length;

        if (!hasContent) {
            console.warn("Skipping empty message");
            return;
        }

        const sent = await targetChannel.send(options);

        messageMapper.saveMapping(message.id, sent.id, context.sourceGcKey, context.targetGcKey);
        messageMapper.setLastSender(context.targetChannelId, message.author.id);
    }

    async deleteMessage(message: Message): Promise<void> {
        const context = getBridgeContext(message.channelId);
        if (!context) return;

        const mapping = messageMapper.getMapping(message.id);
        if (!mapping) return;

        const targetMessageId = mapping[context.targetGcKey];
        if (!targetMessageId) return;

        try {
            const targetChannel = await this.getChannel(context.targetChannelId);
            if (!targetChannel) return;

            const targetMessage = await targetChannel.messages.fetch(targetMessageId);
            await targetMessage.delete();

            messageMapper.deleteMapping(message.id);
        } catch (err: unknown) {
            if (typeof err === "object" && err !== null && "code" in err && err.code === 10008) {
                // Message already deleted
                messageMapper.deleteMapping(message.id);
            } else {
                console.error("Failed to delete forwarded message:", err);
            }
        }
    }

    async updateMessage(newMessage: Message): Promise<void> {
        const context = getBridgeContext(newMessage.channelId);
        if (!context) return;

        const mapping = messageMapper.getMapping(newMessage.id);
        if (!mapping) return;

        const targetMessageId = mapping[context.targetGcKey];
        if (!targetMessageId) return;

        try {
            const targetChannel = await this.getChannel(context.targetChannelId);
            if (!targetChannel) return;

            const targetMessage = await targetChannel.messages.fetch(targetMessageId);

            const displayName = getDisplayName(newMessage);
            const originalContent = targetMessage.content || "";

            let newContent = "";
            const hasHeader = originalContent.startsWith("-#");

            if (hasHeader) {
                const headerMatch = originalContent.match(/^-# .+? said:\n?/);
                if (headerMatch) {
                    newContent = headerMatch[0] + (newMessage.content || "");
                } else {
                    newContent = `-# ${displayName} (<@${newMessage.author.id}>) said:\n${newMessage.content || ""}`;
                }
            } else {
                newContent = newMessage.content || "";
            }

            const maxSize = getMaxAttachmentSize();
            const largeAttachmentLinks: string[] = [];

            for (const attachment of newMessage.attachments.values()) {
                if (attachment.size > maxSize) {
                    const sizeMb = (attachment.size / (1024 * 1024)).toFixed(2);
                    largeAttachmentLinks.push(
                        `[Attachment too large (${sizeMb} MB)]: ${attachment.url}`
                    );
                }
            }

            if (largeAttachmentLinks.length > 0) {
                newContent += `\n${largeAttachmentLinks.join("\n")}`;
            }

            await targetMessage.edit(newContent || " ");
        } catch (err) {
            console.error("Failed to update forwarded message:", err);
        }
    }

    async pinMessage(message: Message): Promise<void> {
        await this.togglePin(message, true);
    }

    async unpinMessage(message: Message): Promise<void> {
        await this.togglePin(message, false);
    }

    private async togglePin(message: Message, pin: boolean): Promise<void> {
        const context = getBridgeContext(message.channelId);
        if (!context) return;

        const mapping = messageMapper.getMapping(message.id);
        if (!mapping) return;

        const targetMessageId = mapping[context.targetGcKey];
        if (!targetMessageId) return;

        try {
            const targetChannel = await this.getChannel(context.targetChannelId);
            if (!targetChannel) return;

            const targetMessage = await targetChannel.messages.fetch(targetMessageId);

            if (pin && !targetMessage.pinned) {
                await targetMessage.pin();
            } else if (!pin && targetMessage.pinned) {
                await targetMessage.unpin();
            }
        } catch (err) {
            console.error(`Failed to ${pin ? "pin" : "unpin"} message:`, err);
        }
    }

    async addReaction(messageId: string, channelId: string, emoji: string): Promise<void> {
        const context = getBridgeContext(channelId);
        if (!context) return;

        const mapping = messageMapper.getMapping(messageId);
        if (!mapping) return;

        const targetMessageId = mapping[context.targetGcKey];
        if (!targetMessageId) return;

        try {
            const targetChannel = await this.getChannel(context.targetChannelId);
            if (!targetChannel) return;

            const targetMessage = await targetChannel.messages.fetch(targetMessageId);
            await targetMessage.react(emoji);
        } catch (err) {
            console.error("Failed to add reaction:", err);
        }
    }

    async removeReaction(messageId: string, channelId: string, emoji: string): Promise<void> {
        const context = getBridgeContext(channelId);
        if (!context) return;

        const mapping = messageMapper.getMapping(messageId);
        if (!mapping) return;

        const targetMessageId = mapping[context.targetGcKey];
        if (!targetMessageId) return;

        try {
            const targetChannel = await this.getChannel(context.targetChannelId);
            if (!targetChannel) return;

            const targetMessage = await targetChannel.messages.fetch(targetMessageId);

            const reaction = targetMessage.reactions.cache.find((r) => {
                if (r.emoji.id) {
                    return r.emoji.identifier === emoji || r.emoji.id === emoji;
                }
                return r.emoji.name === emoji;
            });

            if (reaction && this.client.user) {
                await reaction.users.remove(this.client.user.id);
            }
        } catch (err) {
            console.error("Failed to remove reaction:", err);
        }
    }

    async handleSystemMessage(message: Message): Promise<void> {
        const context = getBridgeContext(message.channelId);
        if (!context) return;

        try {
            const authorName = getDisplayName(message);
            let systemMessage = "";

            switch (message.type) {
                case "CHANNEL_NAME_CHANGE":
                    if (message.content) {
                        systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) changed the other GC title to: ${message.content}`;
                    }
                    break;

                case "CHANNEL_ICON_CHANGE":
                    systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) changed the other GC icon`;
                    break;

                case "RECIPIENT_ADD": {
                    const addedUser = message.mentions.users.first();
                    if (addedUser) {
                        const addedName = addedUser.displayName || addedUser.username;
                        systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) added ${addedName} (<@${addedUser.id}>) to the other GC`;
                    }
                    break;
                }

                case "RECIPIENT_REMOVE": {
                    const removedUser = message.mentions.users.first();
                    if (removedUser) {
                        const removedName = removedUser.displayName || removedUser.username;
                        if (removedUser.id === message.author.id) {
                            systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) left the other GC`;
                        } else {
                            systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) removed ${removedName} (<@${removedUser.id}>) from the other GC`;
                        }
                    }
                    break;
                }

                case "CALL": {
                    systemMessage = `[SYSTEM] ${authorName} (<@${message.author.id}>) started a VC`;
                    const targetChannel = await this.getChannel(context.targetChannelId);
                    if (targetChannel) {
                        const sent = await targetChannel.send(systemMessage);
                        messageMapper.setActiveCall(message.channelId, sent.id);
                    }
                    return;
                }
            }

            if (systemMessage) {
                const targetChannel = await this.getChannel(context.targetChannelId);
                if (targetChannel) {
                    await targetChannel.send(systemMessage);
                }
            }
        } catch (err) {
            console.error("Failed to handle system message:", err);
        }
    }

    async handleVoiceCallEnd(channelId: string): Promise<void> {
        const context = getBridgeContext(channelId);
        if (!context) return;

        const callMessageId = messageMapper.getActiveCall(channelId);
        if (!callMessageId) return;

        try {
            const targetChannel = await this.getChannel(context.targetChannelId);
            if (!targetChannel) return;

            const options: MessageOptions = {
                content: "[SYSTEM] VC has ended",
                reply: { messageReference: callMessageId },
            };

            await targetChannel.send(options);
            messageMapper.clearActiveCall(channelId);
        } catch (err) {
            console.error("Failed to send VC ended message:", err);
        }
    }

    async sendToAllChannels(content: string): Promise<void> {
        const { config } = await import("../config/config.js");

        try {
            const gc1 = await this.getChannel(config.gc["1"]);
            const gc2 = await this.getChannel(config.gc["2"]);

            if (gc1) await gc1.send(content);
            if (gc2) await gc2.send(content);
        } catch (err) {
            console.error("Failed to send to all channels:", err);
        }
    }

    async sendToOtherChannel(sourceChannelId: string, content: string): Promise<Message | null> {
        const context = getBridgeContext(sourceChannelId);
        if (!context) return null;

        try {
            const targetChannel = await this.getChannel(context.targetChannelId);
            if (!targetChannel) return null;

            return await targetChannel.send(content);
        } catch (err) {
            console.error("Failed to send to other channel:", err);
            return null;
        }
    }

    clearLastSender(channelId: string): void {
        messageMapper.clearLastSender(channelId);
    }
}
