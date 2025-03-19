#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const semver_1 = __importDefault(require("semver"));
const util_1 = __importDefault(require("util"));
const common_tags_1 = require("common-tags");
require("./common/env");
const logger_1 = __importDefault(require("./common/logger"));
const create_cli_1 = require("./create-cli");
const MIN_NODE_VERSION = '18.0.0';
const { version } = process;
if (!semver_1.default.satisfies(version, `>=${MIN_NODE_VERSION}`, {
    includePrerelease: true,
})) {
    logger_1.default.panic((0, common_tags_1.stripIndent)(`
            App-builder requires Node.js ${MIN_NODE_VERSION} or higher (you have ${version}).
            Upgrade Node to the latest stable release.
        `));
}
if (semver_1.default.prerelease(version)) {
    logger_1.default.warning((0, common_tags_1.stripIndent)(`
            You are currently using a prerelease version of Node (${version}), which is not supported.
            You can use this for testing, but we do not recommend it in production.
            Before reporting any bugs, please test with a supported version of Node (>=${MIN_NODE_VERSION}).
        `));
}
process.on('unhandledRejection', (reason) => {
    // This will exit the process in newer Node anyway so lets be consistent
    // across versions and crash
    // reason can be anything, it can be a message, an object, ANYTHING!
    // we convert it to an error object
    const error = reason instanceof Error ? reason : new Error(util_1.default.format(reason));
    logger_1.default.panic('UNHANDLED REJECTION', error);
});
process.on('uncaughtException', (error) => {
    logger_1.default.panic('UNHANDLED EXCEPTION', error);
});
process.on('exit', (code) => {
    logger_1.default.message(`Exit with code: ${code}`);
});
(0, create_cli_1.createCli)(process.argv);
