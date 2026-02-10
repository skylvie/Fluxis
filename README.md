# Fluxis
Fluxis is a Discord selfbot that can be used to extend GDMs.

> [!WARNING]
> Fluxis uses Discord selfbots, which are against Discord's ToS! I am not liable if your account gets banned.

## Setup
```sh
git clone https://github.com/skylvie/fluxis
cd fluxis
pnpm i
```

Copy `config.example.json` to `config.json`, and fill in your details.
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

Once that is done:

```sh
pnpm start
```
### Discord
Add your selfbot account to both of the group chats that you are trying to bridge. Making a second account isn't required, but I highly advise you DO NOT use your main account as selfbots are against Discord's ToS. It is safer to create an alternative Discord account to use as the selfbot. It is recommended to not make the selfbot the owner of the second group chat, just in case the account gets either suspended or terminated.

To get channel IDs: Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode), then right-click on the group chat and click "Copy Channel ID".

The selfbot should be present as a regular member in both group chats (ownership is not required).

Once the bot is running, messages sent in GC #1 will be forwarded to GC #2, and vice versa.
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
- Pinning / unpinning messages
- People being added/removed from a GC
- Changing GC icon or name

### What features don't work?
TL;DR: Nitro features (unless the user hosting the selfbot has Nitro).
- Currently, the bot forwards message attachments by copying them directly. If an attachment exceeds 10MB, the bot will not re-upload it and will instead include the original message's CDN link.
- Nitro emojis (if the selfbot is in same server as the source, it'll work)

### Murky areas
- As expected, calls are unable to work using the selfbot. However, messages will be sent if a call is both started and ended.
