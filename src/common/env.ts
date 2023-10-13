import {resolve} from 'node:path';
import {config} from 'dotenv';

config({path: resolve(process.cwd(), '.env')});
