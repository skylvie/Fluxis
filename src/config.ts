import * as fs from 'fs';
import * as path from 'path';

interface Config {
    token: string;
    prefix: string;
    owner_id: string;
    gc: {
        1: string;
        2: string;
    };
}


const cfgPath = path.join(process.cwd(), 'config.json');

if (!fs.existsSync(cfgPath)) {
    console.error('Config file not found!!');
    process.exit(1);
}

const raw = fs.readFileSync(cfgPath, 'utf-8');

export const config: Config = JSON.parse(raw);
