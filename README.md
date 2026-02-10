# Fluxis
Fluxis is a Discord selfbot for extending GDMs
> [!WARNING]
> Fluxis uses Discord selfbots, which are against Discord's ToS! I am not responsible if your account gets banned

## Setup
```sh
git clone https://github.com/skylvie/fluxis
cd fluxis
pnpm i
# setup config.json
pnpm start
```

### Config
config.json:
```jsonc
{
    "token": "YOUR_DISCORD_TOKEN_HERE", // Discord token of the selfbot user you want to use
    "prefix": "$fx", // Prefix used for commands. E.g. $fx uptime
    "cache_to_file": true, // Cache needed content to a local file. Good if the selfbot doesn't have perfect uptime
    "has_nitro": false, // If the selfbot user has Nitro
    "debug_to_dms": true, // Send all console calls to owner's DMs
    "owner_id": "YOUR_USER_ID_HERE", // Your/owner's user ID
    "gc": {
        "1": "FIRST_GROUP_CHANNEL_ID", // GC channel ID #1
        "2": "SECOND_GROUP_CHANNEL_ID" // GC channel ID #2
    }
}
```

### Discord
Add the selfbot account to both GCs, and it just works! You could do it on your main account as well but I don't recommend doing this because selfbots are against Discord's ToS and you could be banned. **MAKE SURE THE BOT OWNS THE 2ND GC!**

## Commands
Using $fx as the prefix:
```
$fx uptime - Shows uptime as Discord timestamp (anyone can use)
$fx ping - Shows API and WS ping (anyone can use)
$fx echo $MESSAGE - Sends $MESSAGE as bot in both GCs (owner only)
$fx update - Checks for updates (owner only)
$fx restart - Restart the bot (owner only)
$fx stop - Stop the bot (owner only)
```

## Support
- **ALL** types of messages
- Forwarded messages
- Stickers
- Attachments (videos, photos, etc.)
- Voice messages
- Deleting & editing messages
- Replies
- Reactions
- Pinning / unpinning
- People being added/removed from a GC
- Changing GC icon or name

### What doesn't work?
TL;DR: Nitro features (unless the selfbot user has Nitro)
- If a file size is over 10MB, instead of re-uploading the attachment, it'll paste the CDN link in the message instead
- Nitro emojis (if selfbot is in same server as the source it'll work)
- Nitro stickers (see above)

### Murky areas
- Of course, calls don't work. However, messages get sent if a call is started and ended
