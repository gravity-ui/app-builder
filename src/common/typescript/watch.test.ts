import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import typescript from 'typescript';
import type Typescript from 'typescript';
import {jest} from '@jest/globals';

import {watch} from './watch.js';

describe('TypeScript watch', () => {
    it('overrides tsBuildInfoFile only for the root project', () => {
        const configPath = '/project/src/server/tsconfig.json';
        const referencedConfigPath = '/project/packages/shared/tsconfig.json';
        const tsBuildInfoFile = '/project/dist/server/.tsbuildinfo';
        const getParsedCommandLineOfConfigFile = jest.fn(
            (_fileName: string, _options?: Typescript.CompilerOptions) => ({
                options: {},
                fileNames: [],
                errors: [],
            }),
        );
        const host = {
            readFile: jest.fn(),
            createProgram: jest.fn(),
        };
        const build = jest.fn();
        const ts = {
            version: '5.6.3',
            sys: {
                newLine: '\n',
                useCaseSensitiveFileNames: true,
                getCurrentDirectory: () => '/project',
                readDirectory: jest.fn(),
                fileExists: jest.fn(),
                readFile: jest.fn(),
            },
            findConfigFile: jest.fn(
                (searchPath: string, _fileExists: unknown, fileName = 'tsconfig.json') =>
                    `${searchPath}/${fileName}`,
            ),
            getParsedCommandLineOfConfigFile,
            createEmitAndSemanticDiagnosticsBuilderProgram: jest.fn(),
            createSolutionBuilderWithWatchHost: jest.fn(() => host),
            createSolutionBuilderWithWatch: jest.fn(
                (solutionHost: typeof host & {getParsedCommandLine(path: string): unknown}) => {
                    solutionHost.getParsedCommandLine(configPath);
                    solutionHost.getParsedCommandLine(referencedConfigPath);
                    return {build};
                },
            ),
        } as unknown as typeof Typescript;
        const logger = {
            message: jest.fn(),
            verbose: jest.fn(),
            status: jest.fn(),
            clearLine: jest.fn(),
            colors: {dim: (value: string) => value},
            isVerbose: false,
        };

        watch(ts, '/project/src/server', {
            logger: logger as never,
            tsBuildInfoFile,
        });

        expect(getParsedCommandLineOfConfigFile).toHaveBeenNthCalledWith(
            1,
            configPath,
            expect.objectContaining({tsBuildInfoFile, noEmit: false}),
            expect.any(Object),
        );
        expect(getParsedCommandLineOfConfigFile).toHaveBeenNthCalledWith(
            2,
            referencedConfigPath,
            expect.objectContaining({noEmit: false}),
            expect.any(Object),
        );
        expect(getParsedCommandLineOfConfigFile.mock.calls[1]?.[1]).not.toHaveProperty(
            'tsBuildInfoFile',
        );
        expect(build).toHaveBeenCalledTimes(1);
    });

    it('rewrites path aliases on rebuilds triggered by file changes', async () => {
        const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-builder-watch-'));
        const serverPath = path.join(root, 'src/server');
        const entryPath = path.join(serverPath, 'index.ts');
        const outputPath = path.join(root, 'dist/server/index.js');
        await fs.promises.mkdir(path.join(root, 'src/shared'), {recursive: true});
        await fs.promises.mkdir(serverPath);
        await fs.promises.writeFile(
            path.join(serverPath, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    module: 'commonjs',
                    rootDir: '..',
                    outDir: '../../dist',
                    paths: {'shared/*': ['../shared/*']},
                },
            }),
        );
        await fs.promises.writeFile(
            path.join(root, 'src/shared/value.ts'),
            'export const value = 1;\n',
        );
        await fs.promises.writeFile(entryPath, "export {value} from 'shared/value';\n");

        const {watchFile, watchDirectory} = typescript.sys;
        if (!watchFile || !watchDirectory) {
            throw new Error('TypeScript cannot watch files in this environment');
        }
        const watchers: Typescript.FileWatcher[] = [];
        const trackWatcher =
            <T extends unknown[]>(fn: (...args: T) => Typescript.FileWatcher) =>
            (...args: T) => {
                const watcher = fn(...args);
                watchers.push(watcher);
                return watcher;
            };
        const sys = {
            ...typescript.sys,
            watchFile: trackWatcher(watchFile),
            watchDirectory: trackWatcher(watchDirectory),
        };
        let resolveEmit = () => {};
        const nextEmit = () =>
            new Promise<void>((resolve) => {
                resolveEmit = resolve;
            });

        try {
            let emitted = nextEmit();
            watch({...typescript, sys}, serverPath, {
                logger: {message: jest.fn(), verbose: jest.fn(), isVerbose: false} as never,
                onAfterFilesEmitted: () => resolveEmit(),
            });
            await emitted;
            expect(await fs.promises.readFile(outputPath, 'utf-8')).toContain(
                'require("../shared/value")',
            );

            emitted = nextEmit();
            await fs.promises.appendFile(entryPath, 'export const next = 2;\n');
            await emitted;
            const output = await fs.promises.readFile(outputPath, 'utf-8');
            expect(output).toContain('next = 2');
            expect(output).toContain('require("../shared/value")');
        } finally {
            watchers.forEach((watcher) => watcher.close());
            await fs.promises.rm(root, {recursive: true, force: true});
        }
    }, 30_000);
});
