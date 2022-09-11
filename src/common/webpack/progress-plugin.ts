import * as webpack from 'webpack';
import type {Logger} from '../logger';
import {elapsedTime} from '../logger/pretty-time';

interface State {
    done?: boolean;
    start?: bigint;
}

export class ProgressPlugin extends webpack.ProgressPlugin {
    private _logger: Logger;
    private _state: State = {};

    constructor({logger}: {logger: Logger}) {
        super();
        this._logger = logger;
    }

    handler = (percent: number, message: string, ...details: string[]) => {
        const progress = Math.floor(percent * 100);
        this._logger.status(
            `${this._logger.colors.green(`${progress}%`)} - ${this._logger.colors.yellow(message)}${
                details.length > 0 ? `: ${this._logger.colors.dim(...details)}` : ''
            }`,
        );
    };

    apply(compiler: webpack.Compiler) {
        super.apply(compiler);

        hook(compiler, 'compile', () => {
            this._logger.message('Start compilation');
            this._logger.message(`Webpack v${compiler.webpack.version}`);
            this._state.start = process.hrtime.bigint();
        });

        hook(compiler, 'invalid', (fileName: string, changeTime: number) => {
            this._logger.verbose(`Invalidate file: ${fileName} at ${changeTime}`);
        });

        hook(compiler, 'done', (stats: webpack.Stats) => {
            const time = this._state.start ? ' in ' + elapsedTime(this._state.start) : '';

            const hasErrors = stats.hasErrors();
            if (hasErrors) {
                this._logger.error('Compiled with some errors' + time);
            } else {
                this._logger.success('Compiled successfully' + time);
            }
        });
    }
}

function hook(
    compiler: webpack.Compiler,
    hookName: keyof webpack.Compiler['hooks'],
    callback: (...args: any[]) => any,
) {
    compiler.hooks[hookName].tap(`app-builder: ${hookName}`, callback);
}
