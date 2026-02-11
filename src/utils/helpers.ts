import type { Message } from "discord.js-selfbot-v13";

/**
 * Gets the most specific display name available for a user.
 * Prefers server nickname over global display name over username.
 */
export function getDisplayName(message: Message): string {
    return message.member?.displayName || message.author.displayName || message.author.username;
}

/**
 * Detects Discord's native forward feature (right-click > Forward Message).
 * Forwards appear as replies with no content/attachments/embeds, just a reference.
 */
export function isForwardedMessage(message: Message): boolean {
    return !!(
        message.reference?.messageId &&
        !message.content &&
        message.attachments.size === 0 &&
        message.embeds.length === 0 &&
        message.stickers.size === 0
    );
}

/**
 * Detects voice messages (audio recording button in Discord mobile/desktop).
 * Discord encodes these as ogg attachments with specific metadata.
 */
export function isVoiceMessage(message: Message): boolean {
    return (
        message.attachments.size > 0 &&
        (message.attachments.first()?.contentType?.includes("audio/ogg") ?? false)
    );
}

/**
 * Checks if message contains a poll.
 * Polls require special handling since they can't be forwarded directly.
 */
export function isPoll(message: Message): boolean {
    return message.poll !== null && message.poll !== undefined;
}
