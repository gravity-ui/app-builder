import path from 'path';
import {convert} from 'tsconfig-to-swcconfig';

const DEFAULT_EXCLUDE = ['node_modules'];

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

export type GetSwcOptionsFromTsconfigOptions = {
    projectPath: string;
    filename?: string;
    additionalPaths?: string[];
    exclude?: string | string[];
};

export function getSwcOptionsFromTsconfig({
    projectPath,
    filename = 'tsconfig.json',
    additionalPaths,
    exclude,
}: GetSwcOptionsFromTsconfigOptions) {
    const swcOptions = convert(filename, projectPath);
    swcOptions.exclude = swcOptions.exclude || [];
    swcOptions.jsc = {
        ...swcOptions.jsc,
        // SWC requires absolute path as baseUrl
        baseUrl: projectPath,
    };

    let customExclude: string[] = [];
    if (Array.isArray(exclude)) {
        customExclude = exclude;
    } else if (exclude) {
        customExclude = [exclude];
    }

    swcOptions.exclude = [...(swcOptions.exclude || []), ...DEFAULT_EXCLUDE, ...customExclude];

    // SWC don't compile referenced files like tsc, so we need collect all directories to compile.
    const paths = swcOptions.jsc.paths || {};
    const directoriesToCompile = [
        ...new Set([projectPath, ...resolvePaths(paths, projectPath), ...(additionalPaths || [])]),
    ];

    return {
        swcOptions,
        directoriesToCompile,
    };
}
