import fs from 'fs';
import path from 'path';
import fastGlob from 'fast-glob';
import {getTsconfig} from 'get-tsconfig';
import {minimatch} from 'minimatch';
import {convertTsConfig} from 'tsconfig-to-swcconfig';
import type {Options} from '@swc/core';

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

function getPathInRootDir(directory: string, rootDir: string, ignore: string[]) {
    const realRoot = getRealPath(rootDir);
    const realRelativePath = path.relative(realRoot, getRealPath(directory));
    const relativePath = [
        path.relative(rootDir, directory),
        path.relative(realRoot, directory),
        realRelativePath,
    ].find((candidate) => !isOutsideRoot(candidate));
    if (relativePath !== undefined && isIgnored(relativePath, ignore)) {
        return undefined;
    }
    if (relativePath === undefined || isOutsideRoot(realRelativePath)) {
        throw new Error(`${directory} is outside server.swcOptions.rootDir ${rootDir}`);
    }
    return path.join(realRoot, relativePath);
}

function isIgnored(file: string, ignore: string[]) {
    let current = path.posix.normalize(file.split(path.sep).join('/'));
    while (current) {
        for (const pattern of ignore) {
            if (minimatch(current, pattern)) {
                return true;
            }
        }
        const parent = path.posix.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return false;
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
            const relativePattern = normalized.replace(/\/+$/, '');
            return [relativePattern, `${cwdPattern}/${relativePattern}`];
        }),
        ...directoryGlobs(outputPath),
    ];
    return [...new Set(ignore)];
}

export function getSwcCliSourceOptions(
    directoriesToCompile: string[],
    rootDir?: string,
    ignore: string[] = [],
) {
    // SWC 0.8.1 skips glob filtering for explicitly named file inputs.
    const filenames = rootDir
        ? directoriesToCompile.flatMap(
              (directory) => getPathInRootDir(directory, rootDir, ignore) ?? [],
          )
        : directoriesToCompile.filter((filename) => !isIgnored(filename, ignore));
    return {
        filenames,
        extensions: EXTENSIONS_TO_COMPILE,
        stripLeadingPaths: !rootDir,
    };
}

let globbedSourcesResolved = false;

// SWC finds a .swcrc above rootDir only for absolute filenames; tinyglobby reads only relative sources literally.
async function resolveGlobbedSources() {
    if (globbedSourcesResolved) {
        return;
    }
    // @ts-ignore @swc/cli is not typed
    const {default: sources} = await import('@swc/cli/lib/swc/sources.js');
    const {globSources} = sources;
    sources.globSources = async (inputs: string[], ...options: unknown[]) => {
        const relativeInputs = inputs.map((input) => {
            const relativePath = path.relative(process.cwd(), input);
            return isOutsideRoot(relativePath) ? input : relativePath || '.';
        });
        const files: string[] = await globSources(relativeInputs, ...options);
        return [...new Set(files.map((file) => path.resolve(file)))];
    };
    globbedSourcesResolved = true;
}

export async function loadSwcCli(
    directoriesToCompile: string[],
    {
        swcOptions,
        rootDir,
        outputPath,
        exclude,
        ignore: ignoredGlobs,
    }: {
        swcOptions: Options;
        rootDir?: string;
        outputPath: string;
        exclude?: string | string[];
        ignore?: string[];
    },
) {
    if (rootDir && (Array.isArray(exclude) ? exclude.length > 0 : Boolean(exclude))) {
        throw new Error(
            'server.swcOptions.exclude cannot be combined with rootDir; use ignore instead',
        );
    }
    const sourceDirectories = rootDir
        ? directoriesToCompile.map((directory) => path.resolve(directory))
        : directoriesToCompile;
    const projectCwd = process.cwd();
    if (rootDir) {
        // @swc/cli maps sources to outputs relative to the working directory it sees on load.
        process.chdir(rootDir);
    }
    // @ts-ignore @swc/cli is not typed
    const {swcDir} = await import('@swc/cli');
    const ignore = getIgnoredGlobs(outputPath, ignoredGlobs);
    const sourceOptions = {
        ...getSwcCliSourceOptions(sourceDirectories, rootDir, ignore),
        ignore,
    };
    if (!rootDir) {
        return {swcDir, sourceOptions, swcOptions};
    }
    await resolveGlobbedSources();
    // SWC matches exclude against the absolute filename, and rootDir may itself be inside node_modules.
    const rootPattern = process.cwd().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
        swcDir,
        sourceOptions,
        swcOptions: {
            ...swcOptions,
            root: projectCwd,
            exclude: DEFAULT_EXCLUDE.map((pattern) => `^${rootPattern}.*${pattern}`),
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
            if (/\.d\.[mc]?ts$/.test(target)) {
                continue;
            }
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
