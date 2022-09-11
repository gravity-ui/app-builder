#!/usr/bin/env node
import util from 'util';

import './common/env';
import logger from './common/logger';
import {createCli} from './create-cli';

export type {ProjectConfig} from './common/models';

process.on('unhandledRejection', (reason) => {
    // This will exit the process in newer Node anyway so lets be consistent
    // across versions and crash

    // reason can be anything, it can be a message, an object, ANYTHING!
    // we convert it to an error object
    if (!(reason instanceof Error)) {
        reason = new Error(util.format(reason));
    }

    logger.panic('UNHANDLED REJECTION', reason as Error);
});

process.on('uncaughtException', (error) => {
    logger.panic('UNHANDLED EXCEPTION', error);
});

process.on('exit', (code) => {
    logger.message(`Exit with code: ${code}`);
});

createCli(process.argv);
