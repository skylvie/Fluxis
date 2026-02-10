# Fluxis
Fluxis is a Discord selfbot for extending GDMs
> [!WARNING]
> Fluxis uses Discord selfbots, which are against ToS!! I am not responsible if your account gets banned

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
    "prefix": "$fx",
    "owner_id": "YOUR_USER_ID_HERE", // Your user ID
    "gc": {
        "1": "FIRST_GROUP_CHANNEL_ID", // GC channel ID #1
        "2": "SECOND_GROUP_CHANNEL_ID" // GC channel ID #2
    }
}
```

### Discord
At the selfbot account to both GCs, and it just works! You could do it on your account as well but I don't recommend doing this because selfbots are against Discords ToS and you could be banned.

## Commands
Using $fx as the prefix:
```
$fx uptime - Shows uptime as Discord timestamp (anyone can use)
$fx ping - Shows API and WS ping (anyone can use)
$fx echo $MESSAGE - Sends $MESSAGE as bot in both GCs (owner only)
$fx update - Checks for updates
```

## Support
Fluxis works with **all** types of messages!