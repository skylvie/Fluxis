import type { Config } from './types';
import * as fs from 'node:fs';
import * as path from 'node:path';

const cfgPath = path.join(process.cwd(), 'config.json');

if (!fs.existsSync(cfgPath)) {
    console.error('Config file not found!!');
    process.exit(1);
}

const raw = fs.readFileSync(cfgPath, 'utf-8');
export const config: Config = JSON.parse(raw);
