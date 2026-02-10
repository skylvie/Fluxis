import type { Message } from 'discord.js-selfbot-v13';
import { config } from './config';
import { client, startTime, setShuttingDown } from './state';
import { sendToAllGcs } from './utils';
import { saveCache } from './cache';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function getAltGcChannel(): Promise<any> {
    const gc1 = await client.channels.fetch(config.gc['1']);
    const gc2 = await client.channels.fetch(config.gc['2']);
    
    if (gc1 && 'ownerId' in gc1 && gc1.ownerId === client.user?.id) {
        return gc1;
    }

    if (gc2 && 'ownerId' in gc2 && gc2.ownerId === client.user?.id) {
        return gc2;
    }
    
    return null;
}

async function pingCmd(message: Message): Promise<void> {
    const wsPing = client.ws.ping;
    const apiPingStart = Date.now();
    
    try {
        const msg = await message.reply('Pinging...');
        const apiPing = Date.now() - apiPingStart;

        await msg.edit(`Pong!\nWS ping: ${wsPing}ms\nAPI ping: ${apiPing}ms`);
    } catch (err) {
        console.error('Failed to handle ping command:', err);
    }
}

async function uptimeCmd(message: Message): Promise<void> {
    const timestamp = Math.floor(startTime / 1000);
    
    try {
        await message.reply(`The bot has been started since: <t:${timestamp}:R>`);
    } catch (err) {
        console.error('Failed to handle uptime command:', err);
    }
}

async function echoCmd(message: Message, args: string[]): Promise<void> {
    if (message.author.id !== config.owner_id) {
        try {
            await message.channel.send('[ERROR] This command is owner only!');
        } catch (err) {
            console.error('Failed to send owner-only message:', err);
        }

        return;
    }
    
    const echoMessage = args.slice(1).join(' ');

    if (!echoMessage) {
        try {
            await message.channel.send(`Usage: \`${config.prefix} echo <message>\``);
        } catch (err) {
            console.error('Failed to send usage message:', err);
        }

        return;
    }
    
    await sendToAllGcs(echoMessage);
}

async function updateCmd(message: Message): Promise<void> {
    if (message.author.id !== config.owner_id) {
        try {
            await message.reply('[ERROR] This command is owner only!');
        } catch (err) {
            console.error('Failed to send owner-only message:', err);
        }
        return;
    }
    
    try {
        const statusMsg = await message.reply('Checking for updates...');
        const { stdout, stderr } = await execAsync('git pull');
        const output = stdout + stderr;

        if (output.includes('Already up to date') || output.includes('Already up-to-date')) {
            await statusMsg.edit('No updates found!');
            return;
        }
        
        await statusMsg.edit('Updates found! Updating...');
        await execAsync('pnpm build');
        
        console.log('Update complete, restarting...');
        process.exit(0);
    } catch (err) {
        console.error('Failed to handle update command:', err);
        try {
            await message.reply(`[ERROR] Update failed: ${err}`);
        } catch (replyErr) {
            console.error('Failed to send error reply:', replyErr);
        }
    }
}

async function stopCmd(message: Message): Promise<void> {
    if (message.author.id !== config.owner_id) {
        try {
            await message.reply('[ERROR] This command is owner only!');
        } catch (err) {
            console.error('Failed to send owner-only message:', err);
        }
        return;
    }
    
    try {
        setShuttingDown(true);
        await message.reply('Stopping bot...');
        
        saveCache();
        console.log('[CACHE] Cache saved before stop');
        
        await sendToAllGcs('[SYSTEM] shutdown :(');
        
        client.destroy();
        process.exit(0);
    } catch (err) {
        console.error('Failed to handle stop command:', err);
    }
}

async function restartCmd(message: Message): Promise<void> {
    if (message.author.id !== config.owner_id) {
        try {
            await message.reply('[ERROR] This command is owner only!');
        } catch (err) {
            console.error('Failed to send owner-only message:', err);
        }
        return;
    }
    
    try {
        setShuttingDown(true);
        await message.reply('Restarting bot...');
        
        saveCache();
        console.log('[CACHE] Cache saved before restart');
        
        await sendToAllGcs('[SYSTEM] restarting...');
        
        client.destroy();
        process.exit(0);
    } catch (err) {
        console.error('Failed to handle restart command:', err);
    }
}

async function addCmd(message: Message): Promise<void> {
    if (message.author.id !== config.owner_id) {
        try {
            await message.reply('[ERROR] This command is owner only!');
        } catch (err) {
            console.error('Failed to send owner-only message:', err);
        }
        return;
    }
    
    try {
        const altGc = await getAltGcChannel();
        
        if (!altGc) {
            await message.reply('[ERROR] Could not find alt GC (bot must own one of the GCs)');
            return;
        }
        
        const owner = await client.users.fetch(config.owner_id);
        if (!owner) {
            await message.reply('[ERROR] Could not fetch owner user');
            return;
        }
        
        if (altGc.recipients.has(config.owner_id)) {
            await message.reply('[ERROR] You are already in the alt GC');
            return;
        }
        
        await altGc.addMember(owner);
        await message.reply('Successfully added you to the alt GC');
    } catch (err) {
        console.error('Failed to handle add command:', err);
        try {
            await message.reply(`[ERROR] Failed to add to alt GC: ${err}`);
        } catch (replyErr) {
            console.error('Failed to send error reply:', replyErr);
        }
    }
}

async function rmCmd(message: Message, args: string[]): Promise<void> {
    if (message.author.id !== config.owner_id) {
        try {
            await message.reply('[ERROR] This command is owner only!');
        } catch (err) {
            console.error('Failed to send owner-only message:', err);
        }
        return;
    }
    
    try {
        const altGc = await getAltGcChannel();
        
        if (!altGc) {
            await message.reply('[ERROR] Could not find alt GC (bot must own one of the GCs)');
            return;
        }
        
        let targetUserId = args[1] ? args[1].replace(/[<@!>]/g, '') : config.owner_id;
        
        if (!altGc.recipients.has(targetUserId)) {
            await message.reply('[ERROR] That user is not in the alt GC');
            return;
        }
        
        const targetUser = await client.users.fetch(targetUserId);
        if (!targetUser) {
            await message.reply('[ERROR] Could not fetch target user');
            return;
        }
        
        await altGc.removeMember(targetUser);
        
        if (targetUserId === config.owner_id) {
            await message.reply('Successfully removed you from the alt GC');
        } else {
            await message.reply(`Successfully removed <@${targetUserId}> from the alt GC`);
        }
    } catch (err) {
        console.error('Failed to handle rm command:', err);
        try {
            await message.reply(`[ERROR] Failed to remove from alt GC: ${err}`);
        } catch (replyErr) {
            console.error('Failed to send error reply:', replyErr);
        }
    }
}

export async function handleCommand(message: Message): Promise<boolean> {
    if (!message.content.startsWith(config.prefix)) return false;
    
    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const command = args[0].toLowerCase();
    
    let handled = false;
    
    switch (command) {
        case 'ping':
            await pingCmd(message);
            handled = true;
            break;
        case 'uptime':
            await uptimeCmd(message);
            handled = true;
            break;
        case 'echo':
            await echoCmd(message, args);
            handled = true;
            break;
        case 'update':
            await updateCmd(message);
            handled = true;
            break;
        case 'stop':
            await stopCmd(message);
            handled = true;
            break;
        case 'restart':
            await restartCmd(message);
            handled = true;
            break;
        case 'add':
            await addCmd(message);
            handled = true;
            break;
        case 'rm':
            await rmCmd(message, args);
            handled = true;
            break;
        default:
            return false;
    }
    
    if (handled) {
        const authorName = message.author.displayName || message.author.username;
        console.log(`${authorName} <@${message.author.id}> used command: ${message.content}`);
    }
    
    return handled;
}
