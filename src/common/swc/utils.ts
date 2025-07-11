import path from 'path';
import {convert} from 'tsconfig-to-swcconfig';

export const EXTENSIONS_TO_COMPILE = ['.js', '.ts', '.mts', '.mjs', '.cjs'];

function resolvePaths(paths: Record<string, string[]>, baseUrl: string) {
    const entries = [];
    for (const targets of Object.values(paths)) {
        for (const target of targets) {
            const resolvedPath = path.resolve(baseUrl, target.replace(/\*$/, ''));
            entries.push(resolvedPath);
        }
    }
    return entries;
}

export function getSwcOptionsFromTsconfig(projectPath: string, filename = 'tsconfig.json') {
    const swcOptions = convert(filename, projectPath);
    swcOptions.jsc = {
        ...swcOptions.jsc,
        // SWC requires absolute path as baseUrl
        baseUrl: projectPath,
    };

    // SWC don't compile referenced files like tsc, so we need collect all directories to compile.
    const paths = swcOptions.jsc.paths || {};
    const directoriesToCompile = [projectPath, ...resolvePaths(paths, projectPath)];

    return {
        swcOptions,
        directoriesToCompile,
    };
}
