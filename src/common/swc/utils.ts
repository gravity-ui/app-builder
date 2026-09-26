import fs from 'fs';
import path from 'path';
import fastGlob from 'fast-glob';
import {convert} from 'tsconfig-to-swcconfig';

const DEFAULT_EXCLUDE = ['node_modules'];

export const EXTENSIONS_TO_COMPILE = ['.js', '.ts', '.mts', '.mjs', '.cjs'];

function getPathInRootDir(directory: string, rootDir: string) {
    const relativePath = path.relative(rootDir, directory);
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) {
        throw new Error(`${directory} is outside server.swcOptions.rootDir ${rootDir}`);
    }
    // Not '.': the @swc/cli watcher skips every path whose name starts with a dot.
    return relativePath || process.cwd();
}

export function isExcluded(file: string, exclude: string | string[] = []) {
    const relativePath = path.relative(process.cwd(), file) + (file.endsWith('/') ? '/' : '');
    // eslint-disable-next-line security/detect-non-literal-regexp
    return [exclude].flat().some((pattern) => new RegExp(pattern).test(relativePath));
}

async function findExcludedDirectories(
    directory: string,
    exclude: string | string[],
): Promise<string[]> {
    const entries = await fs.promises.readdir(directory, {withFileTypes: true});
    const found = await Promise.all(
        entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => {
                const child = path.join(directory, entry.name);
                return isExcluded(`${child}/`, exclude)
                    ? [child]
                    : findExcludedDirectories(child, exclude);
            }),
    );
    return found.flat();
}

// Globs for @swc/cli: without them it walks and watches the excluded trees, and it cannot take a regular expression.
export async function getIgnoredGlobs(
    filenames: string[],
    exclude: string | string[] = [],
    outputPath: string,
) {
    const directories = [
        ...(
            await Promise.all(filenames.map((dir) => findExcludedDirectories(dir, exclude)))
        ).flat(),
        path.relative(process.cwd(), outputPath),
        outputPath,
    ];
    return directories.flatMap((directory) => {
        const pattern = fastGlob.convertPathToPattern(directory);
        return [pattern, `${pattern}/**`];
    });
}

export function getSwcCliSourceOptions(directoriesToCompile: string[], rootDir?: string) {
    return {
        // Relative to rootDir, the working directory by then: a symlinked rootDir would not match its real path.
        filenames: rootDir
            ? directoriesToCompile.map((directory) => getPathInRootDir(directory, rootDir))
            : directoriesToCompile,
        extensions: EXTENSIONS_TO_COMPILE,
        stripLeadingPaths: !rootDir,
    };
}

export async function loadSwcCli(directoriesToCompile: string[], rootDir?: string) {
    if (rootDir) {
        // @swc/cli maps sources to outputs relative to the working directory it sees on load.
        process.chdir(rootDir);
    }
    // @ts-ignore @swc/cli is not typed
    const {swcDir} = await import('@swc/cli');
    return {swcDir, sourceOptions: getSwcCliSourceOptions(directoriesToCompile, rootDir)};
}

function resolvePaths(paths: Record<string, string[]>, baseUrl: string) {
    const entries = [];
    for (const [key, targets] of Object.entries(paths)) {
        if (key === '*') {
            continue;
        }

        for (const target of targets) {
            const resolvedPath = path.resolve(baseUrl, target.replace(/\*$/, ''));
            entries.push(resolvedPath);
        }
    }
    return entries;
}

export interface GetSwcOptionsParams {
    projectPath: string;
    filename?: string;
    additionalPaths?: string[];
    exclude?: string | string[];
    publicPath: string;
}

export function getSwcOptions({
    projectPath,
    filename = 'tsconfig.json',
    additionalPaths,
    exclude,
    publicPath,
}: GetSwcOptionsParams) {
    const swcOptions = convert(filename, projectPath);
    swcOptions.exclude = swcOptions.exclude || [];
    swcOptions.jsc = {
        ...swcOptions.jsc,
        // SWC requires absolute path as baseUrl
        baseUrl: projectPath,
        transform: {
            ...swcOptions.jsc?.transform,
            optimizer: {
                ...swcOptions.jsc?.transform?.optimizer,
                globals: {
                    ...swcOptions.jsc?.transform?.optimizer?.globals,
                    vars: {
                        'process.env.PUBLIC_PATH': JSON.stringify(publicPath),
                        ...swcOptions.jsc?.transform?.optimizer?.globals?.vars,
                    },
                },
            },
        },
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
        ...new Set([
            projectPath,
            ...resolvePaths(paths, projectPath),
            ...(additionalPaths || []).map((additionalPath) => path.resolve(additionalPath)),
        ]),
    ];

    return {
        swcOptions,
        directoriesToCompile,
    };
}
