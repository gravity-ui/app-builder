"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
const signal_exit_1 = require("signal-exit");
const controllable_script_1 = require("../../../common/child-process/controllable-script");
const paths_1 = __importDefault(require("../../../common/paths"));
const utils_1 = require("../../../common/utils");
function buildServer(config) {
    (0, utils_1.createRunFolder)();
    return new Promise((resolve, reject) => {
        const build = new controllable_script_1.ControllableScript(`
        let ts;
        try {
            ts = require('typescript');
        } catch (e) {
            if (e.code !== 'MODULE_NOT_FOUND') {
                throw e;
            }
            ts = require(${JSON.stringify(require.resolve('typescript'))});
        }
        const {Logger} = require(${JSON.stringify(require.resolve('../../../common/logger'))});
        const {compile} = require(${JSON.stringify(require.resolve('../../../common/typescript/compile'))});

        const logger = new Logger('server', ${config.verbose});
        compile(ts, {logger, projectPath: ${JSON.stringify(paths_1.default.appServer)}});
    `, null);
        build.start().then(() => {
            build.onExit((code) => {
                if (code) {
                    reject(new Error('Error compile server'));
                }
                else {
                    resolve();
                }
            });
            process.on('SIGINT', async () => {
                await build.stop('SIGINT');
                process.exit(1);
            });
            process.on('SIGTERM', async () => {
                await build.stop('SIGTERM');
                process.exit(1);
            });
            (0, signal_exit_1.onExit)((_code, signal) => {
                build.stop(signal);
            });
        }, (error) => {
            reject(error);
        });
    });
}
