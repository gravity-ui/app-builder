import path from 'path';
import {getTsconfig} from 'get-tsconfig';
import {convertTsConfig} from 'tsconfig-to-swcconfig';

const DEFAULT_EXCLUDE = ['node_modules'];

export const EXTENSIONS_TO_COMPILE = ['.js', '.ts', '.mts', '.mjs', '.cjs'];

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

// SWC keeps output paths relative to cwd. With rootDir, shift outDir by cwd's place inside it to get tsc's layout.
export function getOutputOptions(
    outputPath: string,
    directoriesToCompile: string[],
    rootDir?: string,
) {
    if (!rootDir) {
        return {outDir: outputPath, stripLeadingPaths: true};
    }
    const root = path.resolve(rootDir);
    for (const dir of [process.cwd(), ...directoriesToCompile]) {
        const relative = path.relative(root, path.resolve(dir));
        if (
            relative === '..' ||
            relative.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relative)
        ) {
            throw new Error(`${dir} is outside server.swcOptions.rootDir ${root}`);
        }
    }
    return {
        outDir: path.join(outputPath, path.relative(root, process.cwd())),
        stripLeadingPaths: false,
    };
}

// @swc/cli matches ignore globs against cwd-relative paths when globbing and against absolute paths when watching.
export function getIgnoreGlobs(ignore?: string[]) {
    return ignore?.flatMap((pattern) => [pattern, path.resolve(pattern).split(path.sep).join('/')]);
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
