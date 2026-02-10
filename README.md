# Fluxis
Fluxis is a Discord selfbot for extending GDMs
> [!WARNING]
> Fluxis uses Discord selfbots, which are against Discord's ToS! I am not responsible if your account gets banned

## Setup
```sh
git clone https://github.com/skylvie/fluxis
cd fluxis
pnpm i
```

Copy `config.example.json` to `config.json` and fill in your details (see Config section below). Once that's done:

```sh
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
Add the selfbot account to both GCs. You could use your account but because selfbots are against ToS I recommend using a separate account. I also recommend making the selfbot account the owner of the 2nd/other GC

To get channel IDs: Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode), then right-click on the group chat and click "Copy Channel ID".

Your setup should look like this:
- GC #1: The selfbot is just a regular member
- GC #2: The selfbot is the owner (create a new GC with the bot account if needed)

Once the bot is running, messages sent in GC #1 will forward to GC #2 and vice versa.

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
