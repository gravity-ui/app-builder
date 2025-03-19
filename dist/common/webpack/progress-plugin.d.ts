import type * as Rspack from '@rspack/core';
import type * as Webpack from 'webpack';
import type { Logger } from '../logger';
interface State {
    done?: boolean;
    start?: bigint;
}
export declare function createProgressPlugin<T extends typeof Webpack.ProgressPlugin | typeof Rspack.ProgressPlugin>(BaseClass: T): {
    new ({ logger }: {
        logger: Logger;
    }): {
        logger: Logger;
        state: State;
        handler: (percent: number, message: string, ...details: string[]) => void;
        apply(compiler: Webpack.Compiler): void;
    };
} & T;
export {};
