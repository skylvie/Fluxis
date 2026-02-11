import type { MessageMapping } from "../config/types.js";
import * as callRepo from "../db/repositories/call.repository.js";
import * as messageRepo from "../db/repositories/message.repository.js";
import * as senderRepo from "../db/repositories/sender.repository.js";

/**
 * Central state manager for bridge mappings with write-through cache.
 *
 * Maintains in-memory maps for fast lookups while persisting to SQLite.
 * The bidirectional message mapping ensures we can delete/edit/react from either side.
 */
class MessageMapper {
    private messages = new Map<string, MessageMapping>();
    private lastSenders = new Map<string, string>();
    private activeCalls = new Map<string, string>();

    load(): void {
        this.messages = messageRepo.loadAllMessages();
        this.lastSenders = senderRepo.loadAllSenders();
        this.activeCalls = callRepo.loadAllCalls();

        console.log(
            `Loaded ${this.messages.size} messages, ` +
                `${this.lastSenders.size} senders,` +
                ` ${this.activeCalls.size} calls`
        );
    }

    saveAll(): void {
        messageRepo.saveAllMessages(this.messages);
        senderRepo.saveAllSenders(this.lastSenders);
        callRepo.saveAllCalls(this.activeCalls);
    }

    getMapping(messageId: string): MessageMapping | null {
        return this.messages.get(messageId) ?? null;
    }

    /**
     * Stores bidirectional mapping to enable lookups from either GC.
     * Both the source and target message IDs point to the same mapping object.
     */
    saveMapping(
        sourceId: string,
        targetId: string,
        sourceGcKey: "1" | "2",
        targetGcKey: "1" | "2"
    ): void {
        const mapping: MessageMapping = {
            [sourceGcKey]: sourceId,
            [targetGcKey]: targetId,
        };

        this.messages.set(sourceId, mapping);
        this.messages.set(targetId, mapping);

        messageRepo.saveMessage(sourceId, mapping);
        messageRepo.saveMessage(targetId, mapping);
    }

    deleteMapping(messageId: string): void {
        const mapping = this.messages.get(messageId);
        if (!mapping) return;

        // Remove both sides of the bidirectional mapping
        if (mapping["1"]) {
            this.messages.delete(mapping["1"]);
            messageRepo.deleteMessage(mapping["1"]);
        }
        if (mapping["2"]) {
            this.messages.delete(mapping["2"]);
            messageRepo.deleteMessage(mapping["2"]);
        }
    }

    getLastSender(gcId: string): string | null {
        return this.lastSenders.get(gcId) ?? null;
    }

    setLastSender(gcId: string, userId: string): void {
        this.lastSenders.set(gcId, userId);
        senderRepo.saveSender(gcId, userId);
    }

    clearLastSender(gcId: string): void {
        this.lastSenders.delete(gcId);
        senderRepo.deleteSender(gcId);
    }

    getActiveCall(gcId: string): string | null {
        return this.activeCalls.get(gcId) ?? null;
    }

    setActiveCall(gcId: string, callId: string): void {
        this.activeCalls.set(gcId, callId);
        callRepo.saveCall(gcId, callId);
    }

    clearActiveCall(gcId: string): void {
        this.activeCalls.delete(gcId);
        callRepo.deleteCall(gcId);
    }
}

export const messageMapper = new MessageMapper();
