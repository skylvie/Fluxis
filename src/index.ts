import { BridgeService } from "./bridge/bridge.service.js";
import { config } from "./config/config.js";
import { cleanup, client, setShuttingDown } from "./discord/client.js";
import { setupEventHandlers } from "./discord/events.js";

setupEventHandlers();

const bridge = new BridgeService(client);

process.on("SIGINT", async () => {
    setShuttingDown(true);
    console.log("Shutting down...");

    cleanup();

    try {
        await bridge.sendToAllChannels("[SYSTEM] shutdown :(");
    } catch (err) {
        console.error("Failed to send shutdown messages:", err);
    }

    client.destroy();
    process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    process.exit(1);
});

client.login(config.token).catch((err) => {
    console.error("Failed to login:", err);
    process.exit(1);
});
