import webpack from 'webpack';
import type * as Webpack from 'webpack';
import type {Logger} from '../logger';
import {elapsedTime} from '../logger/pretty-time';
import {rspack} from '@rspack/core';

interface State {
    done?: boolean;
    start?: bigint;
}

function createProgressPlugin(
    BaseClass: typeof webpack.ProgressPlugin | typeof rspack.ProgressPlugin,
) {
    return class ProgressPlugin extends BaseClass {
        logger: Logger;
        state: State = {};

        constructor({logger}: {logger: Logger}) {
            super();
            this.logger = logger;
        }

        handler = (percent: number, message: string, ...details: string[]) => {
            const progress = Math.floor(percent * 100);
            this.logger.status(
                `${this.logger.colors.green(`${progress}%`)} - ${this.logger.colors.yellow(message)}${
                    details.length > 0 ? `: ${this.logger.colors.dim(...details)}` : ''
                }`,
            );
        };

        apply(compiler: Webpack.Compiler) {
            super.apply(compiler);

            hook(compiler, 'compile', () => {
                this.logger.message('Start compilation');
                if ('rspackVersion' in compiler.webpack) {
                    this.logger.message(`Rspack v${compiler.webpack.rspackVersion}`);
                } else {
                    this.logger.message(`Webpack v${compiler.webpack.version}`);
                }
                this.state.start = process.hrtime.bigint();
            });

            hook(compiler, 'invalid', (fileName, changeTime) => {
                this.logger.verbose(`Invalidate file: ${fileName} at ${changeTime}`);
            });

            hook(compiler, 'done', (stats) => {
                const time = this.state.start ? ' in ' + elapsedTime(this.state.start) : '';

                const hasErrors = stats.hasErrors();
                if (hasErrors) {
                    this.logger.error('Compiled with some errors' + time);
                } else {
                    this.logger.success('Compiled successfully' + time);
                }
            });
        }
    };
}

function hook<HookName extends keyof Webpack.Compiler['hooks']>(
    compiler: Webpack.Compiler,
    hookName: HookName,
    callback: Parameters<Webpack.Compiler['hooks'][HookName]['tap']>[1],
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    compiler.hooks[hookName].tap(`app-builder: ${hookName}`, callback as any);
}

export const WebpackProgressPlugin = createProgressPlugin(webpack.ProgressPlugin);
export const RspackProgressPlugin = createProgressPlugin(rspack.ProgressPlugin);
