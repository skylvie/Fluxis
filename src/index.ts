import { Client, Message } from 'discord.js-selfbot-v13';
import { config } from './config';

const client = new Client();
const startTime = Date.now();
let isShuttingDown = false;
const forwardedMessages = new Map<string, { [key: string]: string }>();
const lastSender = new Map<string, string>();

function getOtherGcId(currentGcId: string): string | null {
    if (currentGcId === config.gc['1']) {
        return config.gc['2'];
    } else if (currentGcId === config.gc['2']) {
        return config.gc['1'];
    }

    return null;
}

client.once('ready', async () => {
    console.log(`[DEBUG] Logged in as ${client.user?.tag}`);
    
    try {
        const gc1 = await client.channels.fetch(config.gc['1']);
        const gc2 = await client.channels.fetch(config.gc['2']);
        
        if (gc1?.isText()) {
            await gc1.send('[SYSTEM] started!');
        }
        if (gc2?.isText()) {
            await gc2.send('[SYSTEM] started!');
        }
        
        console.log('[DEBUG] Startup messages sent!');
    } catch (err) {
        console.error('[ERROR] Failed to send startup messages:', err);
    }
});

client.on('messageCreate', async (message: Message) => {
    if (message.channelId !== config.gc['1'] && message.channelId !== config.gc['2']) {
        return;
    }
    
    if (message.author.id === client.user?.id) {
        return;
    }
    
    const otherGcId = getOtherGcId(message.channelId);
    if (!otherGcId) {
        return;
    }
    
    lastSender.delete(message.channelId);
    
    if (message.content.startsWith(config.prefix)) {
        const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
        const command = args[0].toLowerCase();
        
        if (command === 'ping') {
            const wsPing = client.ws.ping;
            const apiPingStart = Date.now();
            
            try {
                const msg = await message.channel.send('Pinging...');
                const apiPing = Date.now() - apiPingStart;
    
                await msg.edit(`Pong!\nWS ping: ${wsPing}ms\nAPI ping: ${apiPing}ms`);
            } catch (err) {
                console.error('[ERROR] Failed to handle ping command:', err);
            }
            return;
        }
        
        if (command === 'uptime') {
            const timestamp = Math.floor(startTime / 1000);
    
            try {
                await message.channel.send(`The bot has been started since: <t:${timestamp}:R>`);
            } catch (err) {
                console.error('[ERROR] Failed to handle uptime command:', err);
            }
            return;
        }
        
        if (command === 'echo') {
            if (message.author.id !== config.owner_id) {
                try {
                    await message.channel.send('[ERROR] This command is owner only!');
                } catch (err) {
                    console.error('[ERROR] Failed to send owner-only message:', err);
                }

                return;
            }
            
            const echoMessage = args.slice(1).join(' ');
            if (!echoMessage) {
                try {
                    await message.channel.send(`Usage: \`${config.prefix} echo <message>\``);
                } catch (err) {
                    console.error('[ERROR] Failed to send usage message:', err);
                }

                return;
            }
            
            try {
                const gc1 = await client.channels.fetch(config.gc['1']);
                const gc2 = await client.channels.fetch(config.gc['2']);
                
                if (gc1?.isText()) {
                    await gc1.send(echoMessage);
                }
                if (gc2?.isText()) {
                    await gc2.send(echoMessage);
                }
            } catch (err) {
                console.error('[ERROR] Failed to handle echo command:', err);
            }

            return;
        }
    }
    
    try {
        const otherChannel = await client.channels.fetch(otherGcId);
        
        if (otherChannel?.isText()) {
            const displayName = message.member?.displayName || message.author.displayName || message.author.username;
            const shouldShowHeader = lastSender.get(otherGcId) !== message.author.id;
            const headerText = shouldShowHeader ? `-# ${displayName} (<@${message.author.id}>) said:` : '';
            
            lastSender.set(otherGcId, message.author.id);
            
            let replyToMessageId: string | undefined;
            if (message.reference && message.reference.messageId) {
                const referencedMessageId = message.reference.messageId;
                const forwardData = forwardedMessages.get(referencedMessageId);
                
                if (forwardData) {
                    const otherGcKey = otherGcId === config.gc['1'] ? '1' : '2';
                    replyToMessageId = forwardData[otherGcKey];
                }
            }
            
            const isPoll = message.poll !== null && message.poll !== undefined;
            const isVoiceMessage = message.attachments.size > 0 && message.attachments.first()?.contentType?.includes('audio/ogg');
            let sentMessage;
            
            if (isPoll || isVoiceMessage) {
                if (headerText) {
                    const headerOptions: any = { content: headerText };

                    if (replyToMessageId) {
                        headerOptions.reply = { messageReference: replyToMessageId };
                    }

                    await otherChannel.send(headerOptions);
                }
                
                const messageOptions: any = {};
                
                if (isPoll && message.poll) {
                    messageOptions.poll = {
                        question: message.poll.question,
                        answers: message.poll.answers.map(a => ({ text: a.text, emoji: a.emoji })),
                        allowMultiselect: message.poll.allowMultiselect
                    };
                }
                
                if (message.attachments.size > 0) {
                    messageOptions.files = Array.from(message.attachments.values());
                }
                
                sentMessage = await otherChannel.send(messageOptions);
            } else {
                let content = '';

                if (headerText) {
                    content = headerText + (message.content ? `\n${message.content}` : '');
                } else {
                    content = message.content || '';
                }
                
                const messageOptions: any = {};
                
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
                const currentGcKey = message.channelId === config.gc['1'] ? '1' : '2';
                const otherGcKey = otherGcId === config.gc['1'] ? '1' : '2';
                const messageData = {
                    [currentGcKey]: message.id,
                    [otherGcKey]: sentMessage.id
                };
                
                forwardedMessages.set(message.id, messageData);
                forwardedMessages.set(sentMessage.id, messageData);
            }
        }
    } catch (err) {
        console.error('[ERROR] Failed to forward message from', message.channelId, 'to', otherGcId, ':', err);
    }
});

process.on('SIGINT', async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('[DEBUG] Shutting down...');
    
    try {
        const gc1 = await client.channels.fetch(config.gc['1']);
        const gc2 = await client.channels.fetch(config.gc['2']);
        
        if (gc1?.isText()) {
            await gc1.send('[SYSTEM] shutdown :(');
        }
        if (gc2?.isText()) {
            await gc2.send('[SYSTEM] shutdown :(');
        }
    } catch (err) {
        console.error('[ERROR] Failed to send shutdown messages:', err);
    }
    
    client.destroy();
    process.exit(0);
});

client.login(config.token).catch(err => {
    console.error('[ERROR] Failed to login:', err);
    process.exit(1);
});
