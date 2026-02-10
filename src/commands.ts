import type { Message } from 'discord.js-selfbot-v13';
import { config } from './config';
import { client, startTime } from './state';
import { sendToAllGcs } from './utils';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function pingCmd(message: Message): Promise<void> {
    const wsPing = client.ws.ping;
    const apiPingStart = Date.now();
    
    try {
        const msg = await message.reply('Pinging...');
        const apiPing = Date.now() - apiPingStart;

        await msg.edit(`Pong!\nWS ping: ${wsPing}ms\nAPI ping: ${apiPing}ms`);
    } catch (err) {
        console.error('[ERROR] Failed to handle ping command:', err);
    }
}

async function uptimeCmd(message: Message): Promise<void> {
    const timestamp = Math.floor(startTime / 1000);
    
    try {
        await message.reply(`The bot has been started since: <t:${timestamp}:R>`);
    } catch (err) {
        console.error('[ERROR] Failed to handle uptime command:', err);
    }
}

async function echoCmd(message: Message, args: string[]): Promise<void> {
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
    
    await sendToAllGcs(echoMessage);
}

async function updateCmd(message: Message): Promise<void> {
    if (message.author.id !== config.owner_id) {
        try {
            await message.reply('[ERROR] This command is owner only!');
        } catch (err) {
            console.error('[ERROR] Failed to send owner-only message:', err);
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
        
        console.log('[INFO] Update complete, restarting...');
        process.exit(0);
    } catch (err) {
        console.error('[ERROR] Failed to handle update command:', err);
        try {
            await message.reply(`[ERROR] Update failed: ${err}`);
        } catch (replyErr) {
            console.error('[ERROR] Failed to send error reply:', replyErr);
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
        default:
            return false;
    }
    
    if (handled) {
        const authorName = message.author.displayName || message.author.username;
        console.log(`[SYSTEM] ${authorName} <@${message.author.id}> used command: ${message.content}`);
    }
    
    return handled;
}
