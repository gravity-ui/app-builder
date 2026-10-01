import type {ServerConfig} from '../models/index.js';

type SwcOptions = NonNullable<ServerConfig['swcOptions']>;

export function pickSwcOptions(options?: SwcOptions) {
    return {
        additionalPaths: options?.additionalPaths,
        exclude: options?.exclude,
        rootDir: options?.rootDir,
        copyFiles: options?.copyFiles,
        ignore: options?.ignore,
    } satisfies Record<keyof SwcOptions, unknown>;
}
