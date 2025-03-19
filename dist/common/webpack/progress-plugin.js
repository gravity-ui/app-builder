"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProgressPlugin = createProgressPlugin;
const pretty_time_1 = require("../logger/pretty-time");
function createProgressPlugin(BaseClass) {
    return class ProgressPlugin extends BaseClass {
        logger;
        state = {};
        constructor({ logger }) {
            super();
            this.logger = logger;
        }
        handler = (percent, message, ...details) => {
            const progress = Math.floor(percent * 100);
            this.logger.status(`${this.logger.colors.green(`${progress}%`)} - ${this.logger.colors.yellow(message)}${details.length > 0 ? `: ${this.logger.colors.dim(...details)}` : ''}`);
        };
        apply(compiler) {
            super.apply(compiler);
            hook(compiler, 'compile', () => {
                this.logger.message('Start compilation');
                if ('rspackVersion' in compiler.webpack) {
                    this.logger.message(`Rspack v${compiler.webpack.rspackVersion}`);
                }
                else {
                    this.logger.message(`Webpack v${compiler.webpack.version}`);
                }
                this.state.start = process.hrtime.bigint();
            });
            hook(compiler, 'invalid', (fileName, changeTime) => {
                this.logger.verbose(`Invalidate file: ${fileName} at ${changeTime}`);
            });
            hook(compiler, 'done', (stats) => {
                const time = this.state.start ? ' in ' + (0, pretty_time_1.elapsedTime)(this.state.start) : '';
                const hasErrors = stats.hasErrors();
                if (hasErrors) {
                    this.logger.error('Compiled with some errors' + time);
                }
                else {
                    this.logger.success('Compiled successfully' + time);
                }
            });
        }
    };
}
function hook(compiler, hookName, callback) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    compiler.hooks[hookName].tap(`app-builder: ${hookName}`, callback);
}
