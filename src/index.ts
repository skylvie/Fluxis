import { client, setShuttingDown } from './state';
import { config } from './config';
import { setupEventHandlers } from './events';
import { sendToAllGcs } from './utils';
import { saveCache, closeCache } from './cache';

setupEventHandlers();

process.on('SIGINT', async () => {
    setShuttingDown(true);
    console.log('Shutting down...');


    saveCache();
    closeCache();
    console.log('Cache saved and closed on shutdown');
    
    try {
        await sendToAllGcs('[SYSTEM] shutdown :(');
    } catch (err) {
        console.error('Failed to send shutdown messages:', err);
    }
    
    client.destroy();
    process.exit(0);
});

client.login(config.token).catch(err => {
    console.error('Failed to login:', err);
    process.exit(1);
});
