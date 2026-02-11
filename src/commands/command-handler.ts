import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Client, Message } from "discord.js-selfbot-v13";
import type { BridgeService } from "../bridge/bridge.service.js";
import { config } from "../config/config.js";
import { saveCache, setShuttingDown, startTime } from "../discord/client.js";

const execAsync = promisify(exec);

interface CommandContext {
    message: Message;
    args: string[];
    client: Client;
    bridge: BridgeService;
}

type CommandHandler = (ctx: CommandContext) => Promise<void>;

/** Map-based command registry for O(1) lookups */
const commands = new Map<string, CommandHandler>();

async function pingCommand(ctx: CommandContext): Promise<void> {
    const wsPing = ctx.client.ws.ping;
    const apiPingStart = Date.now();

    try {
        const msg = await ctx.message.reply("Pinging...");
        const apiPing = Date.now() - apiPingStart;
        await msg.edit(`Pong!\nWS ping: ${wsPing}ms\nAPI ping: ${apiPing}ms`);
    } catch (err) {
        console.error("Ping command failed:", err);
    }
}

async function uptimeCommand(ctx: CommandContext): Promise<void> {
    const timestamp = Math.floor(startTime / 1000);

    try {
        await ctx.message.reply(`The bot has been started since: <t:${timestamp}:R>`);
    } catch (err) {
        console.error("Uptime command failed:", err);
    }
}

async function echoCommand(ctx: CommandContext): Promise<void> {
    if (ctx.message.author.id !== config.owner_id) {
        await ctx.message.channel.send("This command is owner only!");
        return;
    }

    const echoMessage = ctx.args.slice(1).join(" ");
    if (!echoMessage) {
        await ctx.message.channel.send(`Usage: \`${config.prefix} echo <message>\``);
        return;
    }

    await ctx.bridge.sendToAllChannels(echoMessage);
}

async function updateCommand(ctx: CommandContext): Promise<void> {
    if (ctx.message.author.id !== config.owner_id) {
        await ctx.message.reply("This command is owner only!");
        return;
    }

    try {
        const statusMsg = await ctx.message.reply("Checking for updates...");
        const { stdout, stderr } = await execAsync("git pull");
        const output = stdout + stderr;

        if (output.includes("Already up to date") || output.includes("Already up-to-date")) {
            await statusMsg.edit("No updates found!");
            return;
        }

        await statusMsg.edit("Updates found! Updating...");
        await execAsync("pnpm build");

        // Exit and rely on process manager (pm2/systemd) to restart
        console.log("Update complete, restarting...");
        process.exit(0);
    } catch (err) {
        console.error("Update command failed:", err);
        await ctx.message.reply(`Update failed: ${err}`);
    }
}

async function stopCommand(ctx: CommandContext): Promise<void> {
    if (ctx.message.author.id !== config.owner_id) {
        await ctx.message.reply("This command is owner only!");
        return;
    }

    try {
        setShuttingDown(true);
        await ctx.message.reply("Stopping bot...");
        saveCache();
        await ctx.bridge.sendToAllChannels("[SYSTEM] shutdown :(");

        ctx.client.destroy();
        process.exit(0);
    } catch (err) {
        console.error("Stop command failed:", err);
    }
}

async function restartCommand(ctx: CommandContext): Promise<void> {
    if (ctx.message.author.id !== config.owner_id) {
        await ctx.message.reply("This command is owner only!");
        return;
    }

    try {
        setShuttingDown(true);
        await ctx.message.reply("Restarting bot...");
        saveCache();
        await ctx.bridge.sendToAllChannels("[SYSTEM] restarting...");

        ctx.client.destroy();
        process.exit(0);
    } catch (err) {
        console.error("Restart command failed:", err);
    }
}

commands.set("ping", pingCommand);
commands.set("uptime", uptimeCommand);
commands.set("echo", echoCommand);
commands.set("update", updateCommand);
commands.set("stop", stopCommand);
commands.set("restart", restartCommand);

/**
 * Routes message to appropriate command handler if it matches the prefix.
 *
 * @returns true if a command was handled, false otherwise
 */
export async function handleCommand(
    message: Message,
    client: Client,
    bridge: BridgeService
): Promise<boolean> {
    if (!message.content.startsWith(config.prefix)) return false;

    const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args[0].toLowerCase();

    const handler = commands.get(commandName);
    if (!handler) return false;

    const authorName = message.author.displayName || message.author.username;
    console.log(`${authorName} <@${message.author.id}> used command: ${message.content}`);

    await handler({ message, args, client, bridge });
    return true;
}
