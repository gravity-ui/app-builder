#!/usr/bin/env node
import semver from 'semver';
import util from 'util';
import {stripIndent} from 'common-tags';

import './common/env';
import logger from './common/logger';
import {createCli} from './create-cli';

export type {ProjectConfig} from './common/models';

const MIN_NODE_VERSION = '18.0.0';

const {version} = process;

if (
    !semver.satisfies(version, `>=${MIN_NODE_VERSION}`, {
        includePrerelease: true,
    })
) {
    logger.panic(
        stripIndent(`
            App-builder requires Node.js ${MIN_NODE_VERSION} or higher (you have ${version}).
            Upgrade Node to the latest stable release.
        `),
    );
}
if (semver.prerelease(version)) {
    logger.warning(
        stripIndent(`
            You are currently using a prerelease version of Node (${version}), which is not supported.
            You can use this for testing, but we do not recommend it in production.
            Before reporting any bugs, please test with a supported version of Node (>=${MIN_NODE_VERSION}).
        `),
    );
}

process.on('unhandledRejection', (reason) => {
    // This will exit the process in newer Node anyway so lets be consistent
    // across versions and crash

    // reason can be anything, it can be a message, an object, ANYTHING!
    // we convert it to an error object
    const error = reason instanceof Error ? reason : new Error(util.format(reason));

    logger.panic('UNHANDLED REJECTION', error);
});

process.on('uncaughtException', (error) => {
    logger.panic('UNHANDLED EXCEPTION', error);
});

process.on('exit', (code) => {
    logger.message(`Exit with code: ${code}`);
});

createCli(process.argv);
