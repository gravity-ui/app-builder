import path from 'node:path';
import paths from '../paths';

import type Typescript from 'typescript';
import type {Logger} from '../logger';

export function getProjectConfig(
    ts: typeof Typescript,
    projectPath: string,
    filename = 'tsconfig.json',
) {
    const configPath = ts.findConfigFile(projectPath, ts.sys.fileExists, filename);
    if (!configPath) {
        throw new Error(`Could not find a valid '${filename}'.`);
    }

    return configPath;
}

export function displayFilename(
    originalFunc: (path: string, encoding?: string) => string | undefined,
    operationName: string,
    logger: Logger,
) {
    let displayEnabled = false;
    let count = 0;
    function displayFunction(...args: [path: string, encoding?: string]) {
        count++;
        if (displayEnabled) {
            const fileName = args[0];
            logger.status(logger.colors.dim(`${operationName}: ${fileName}`));
        }
        return originalFunc(...args);
    }
    displayFunction.originalFunc = originalFunc;
    displayFunction.enableDisplay = () => {
        count = 0;
        if (process.stdout.isTTY && logger.isVerbose) {
            displayEnabled = true;
        }
    };
    displayFunction.disableDisplay = () => {
        if (displayEnabled) {
            displayEnabled = false;
            logger.clearLine();
        }
        return count;
    };
    return displayFunction;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onHostEvent<F extends string, T extends {[key in F]?: (...args: any[]) => any}>(
    host: T,
    functionName: F,
    before?: (...args: Parameters<NonNullable<T[F]>>) => void,
    after?: (res: ReturnType<NonNullable<T[F]>>) => void,
) {
    const originalFunction = host[functionName];

    // eslint-disable-next-line no-param-reassign
    host[functionName] = ((...args: Parameters<NonNullable<T[F]>>) => {
        if (before) {
            before(...args);
        }

        let result;
        if (typeof originalFunction === 'function') {
            result = originalFunction(...args);
        }

        if (after) {
            after(result);
        }
        return result;
    }) as T[F];
}

export function resolveTypescript() {
    try {
        return require.resolve(path.resolve(paths.appNodeModules, 'typescript'));
    } catch (err) {
        if (
            !err ||
            typeof err !== 'object' ||
            !('code' in err) ||
            err.code !== 'MODULE_NOT_FOUND'
        ) {
            throw err;
        }
        return require.resolve('typescript');
    }
}
