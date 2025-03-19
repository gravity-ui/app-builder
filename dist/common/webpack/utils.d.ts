import type * as Webpack from 'webpack';
import type { Logger } from '../logger';
import { MultiStats } from '@rspack/core';
export declare function compilerHandlerFactory(logger: Logger, onCompilationEnd?: () => void): (err?: Error | null, stats?: Webpack.MultiStats | MultiStats) => Promise<void>;
export declare function resolveTsConfigPathsToAlias(projectPath: string, filename?: string): {
    aliases?: undefined;
    modules?: undefined;
} | {
    aliases: Record<string, string[]>;
    modules: string[];
};
