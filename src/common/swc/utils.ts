import fs from 'fs';
import path from 'path';
import fastGlob from 'fast-glob';
import {getTsconfig} from 'get-tsconfig';
import {minimatch} from 'minimatch';
import {convertTsConfig} from 'tsconfig-to-swcconfig';

const DEFAULT_EXCLUDE = ['node_modules'];

export const EXTENSIONS_TO_COMPILE = ['.js', '.ts', '.mts', '.mjs', '.cjs'];

function getRealPath(filePath: string) {
    try {
        return fs.realpathSync(filePath);
    } catch {
        return filePath;
    }
}

function isOutsideRoot(relativePath: string) {
    return (
        relativePath === '..' ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
    );
}

function getPathInRootDir(directory: string, rootDir: string) {
    const realRoot = getRealPath(rootDir);
    const realRelativePath = path.relative(realRoot, getRealPath(directory));
    if (isOutsideRoot(realRelativePath)) {
        throw new Error(`${directory} is outside server.swcOptions.rootDir ${rootDir}`);
    }
    const relativePath =
        [path.relative(rootDir, directory), path.relative(realRoot, directory)].find(
            (candidate) => !isOutsideRoot(candidate),
        ) ?? realRelativePath;
    // The @swc/cli watcher skips paths whose basename starts with a dot.
    return relativePath || process.cwd();
}

function isIgnored(file: string, ignore: string[]) {
    const normalized = file.split(path.sep).join('/');
    return ignore.some((pattern) => minimatch(normalized, pattern));
}

function directoryGlobs(directory: string) {
    const relative = path.relative(process.cwd(), directory);
    return [relative, path.resolve(directory)].flatMap((entry) => {
        const pattern = fastGlob.convertPathToPattern(entry);
        return [pattern, `${pattern}/**`];
    });
}

export function getIgnoredGlobs(outputPath: string, ignoredGlobs: string[] = []) {
    const cwdPattern = fastGlob.convertPathToPattern(process.cwd());
    const ignore = [
        ...ignoredGlobs.flatMap((pattern) => {
            const normalized = pattern
                .split(path.sep)
                .join('/')
                .replace(/^(\.\/)+/, '');
            if (
                !normalized ||
                path.posix.isAbsolute(normalized) ||
                path.win32.isAbsolute(normalized) ||
                normalized.startsWith('!') ||
                normalized.split('/').includes('..')
            ) {
                throw new Error(
                    `server.swcOptions.ignore must contain relative globs without negation or parent traversal: ${pattern}`,
                );
            }
            return [normalized, `${cwdPattern}/${normalized}`];
        }),
        ...directoryGlobs(outputPath),
    ];
    return [...new Set(ignore)];
}

export function getSwcCliSourceOptions(directoriesToCompile: string[], rootDir?: string) {
    return {
        filenames: rootDir
            ? directoriesToCompile.map((directory) => getPathInRootDir(directory, rootDir))
            : directoriesToCompile,
        extensions: EXTENSIONS_TO_COMPILE,
        stripLeadingPaths: !rootDir,
    };
}

export async function loadSwcCli(
    directoriesToCompile: string[],
    {
        rootDir,
        outputPath,
        ignore: ignoredGlobs,
    }: {
        rootDir?: string;
        outputPath: string;
        ignore?: string[];
    },
) {
    const sourceDirectories = rootDir
        ? directoriesToCompile.map((directory) => path.resolve(directory))
        : directoriesToCompile;
    if (rootDir) {
        // @swc/cli maps sources to outputs relative to the working directory it sees on load.
        process.chdir(rootDir);
    }
    // @ts-ignore @swc/cli is not typed
    const {swcDir} = await import('@swc/cli');
    const sourceOptions = getSwcCliSourceOptions(sourceDirectories, rootDir);
    const ignore = getIgnoredGlobs(outputPath, ignoredGlobs);
    return {
        swcDir,
        sourceOptions: {
            ...sourceOptions,
            // SWC 0.8.1 skips glob filtering for explicitly named file inputs.
            filenames: sourceOptions.filenames.filter((filename) => !isIgnored(filename, ignore)),
            ignore,
        },
    };
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
    const compilerOptions = getTsconfig(projectPath, filename)?.config.compilerOptions ?? {};
    const swcOptions = convertTsConfig(compilerOptions, undefined, projectPath);
    swcOptions.exclude = swcOptions.exclude || [];
    swcOptions.jsc = {
        ...swcOptions.jsc,
        // SWC requires absolute path as baseUrl
        baseUrl: projectPath,
        transform: {
            ...swcOptions.jsc?.transform,
            // TODO: tsconfig-to-swcconfig 2 drops this option; v3 maps it but needs Node 22 and @swc/core 1.16.2
            useDefineForClassFields: compilerOptions.useDefineForClassFields ?? true,
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
        ...new Set([projectPath, ...resolvePaths(paths, projectPath), ...(additionalPaths || [])]),
    ];

    return {
        swcOptions,
        directoriesToCompile,
    };
}
