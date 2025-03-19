"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const signal_exit_1 = require("signal-exit");
const controllable_script_1 = require("../../common/child-process/controllable-script");
function default_1(config) {
    return new Promise((resolve, reject) => {
        const build = new controllable_script_1.ControllableScript(`
        const {buildLibrary} = require(${JSON.stringify(require.resolve('../../common/library'))});
        buildLibrary({lib: ${JSON.stringify(config.lib)}});
            `, null);
        build.start().then(() => {
            build.onExit((code) => {
                if (code) {
                    reject(new Error('Error build library'));
                }
                else {
                    resolve(true);
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
