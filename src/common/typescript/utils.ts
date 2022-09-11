import type Typescript from 'typescript';
import type {Logger} from '../logger';

export function getProjectConfig(ts: typeof Typescript, projectPath: string) {
    const configPath = ts.findConfigFile(projectPath, ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
        throw new Error("Could not find a valid 'tsconfig.json'.");
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

export function onHostEvent(
    host: any,
    functionName: any,
    before?: (...args: any[]) => void,
    after?: (...args: any[]) => void,
) {
    const originalFunction = host[functionName];

    host[functionName] = (...args: any[]) => {
        if (before) {
            before(...args);
        }
        const result = originalFunction && originalFunction(...args);
        if (after) {
            after(result);
        }
        return result;
    };
}
