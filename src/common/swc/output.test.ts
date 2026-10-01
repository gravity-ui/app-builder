import {spawn} from 'node:child_process';
import {once} from 'node:events';
import * as fs from 'node:fs';
import {createRequire} from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import {jest} from '@jest/globals';

import {Logger} from '../logger/index.js';
import {compile} from './compile.js';
import {getIgnoredGlobs, getSwcCliSourceOptions, getSwcOptions, loadSwcCli} from './utils.js';

const require = createRequire(path.join(process.cwd(), 'package.json'));
jest.unstable_mockModule('@swc/cli', () => ({
    swcDir: async () => {},
}));

describe('SWC server output', () => {
    const cwd = process.cwd();
    let root: string;

    beforeEach(async () => {
        root = fs.realpathSync(
            await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-builder-swc-output-')),
        );
        const files: Record<string, string> = {
            'src/server/tsconfig.json': JSON.stringify({
                compilerOptions: {
                    module: 'commonjs',
                    target: 'es2019',
                    esModuleInterop: true,
                    paths: {
                        'shared/*': ['../shared/*'],
                        data: ['./data.json'],
                        ignored: ['./ignored.json'],
                        fixture: ['./fixtures/skipped.json'],
                    },
                },
            }),
            'src/server/index.ts': [
                "import {value} from 'shared/value';",
                "import data from './data.json';",
                'export const sum = value + data.count;',
            ].join('\n'),
            'src/server/data.json': JSON.stringify({count: 2}),
            'src/server/fixtures/skipped.json': '{}',
            'src/server/styles.css': 'body {}',
            'src/server/ignored.json': '{}',
            'src/shared/value.ts': 'export const value = 1;',
            'extras/skip.ts': 'export const value = 1;',
            'extras/keep.ts': 'export const value = 1;',
            'src/server/dist/old.json': '{}',
            'src/server/.cache/old.json': '{}',
        };
        for (const [file, content] of Object.entries(files)) {
            await fs.promises.mkdir(path.dirname(path.join(root, file)), {recursive: true});
            await fs.promises.writeFile(path.join(root, file), content);
        }
    });

    afterEach(async () => {
        process.chdir(cwd);
        await fs.promises.rm(root, {recursive: true, force: true});
    });

    async function start({
        copyFiles,
        watch = false,
        rootIsSource = false,
        legacyPaths = false,
        ignorePattern,
        fixturesPattern = '**/fixtures/**',
    }: {
        copyFiles: boolean;
        watch?: boolean;
        rootIsSource?: boolean;
        legacyPaths?: boolean;
        ignorePattern?: string;
        fixturesPattern?: string;
    }) {
        process.chdir(root);
        const additionalPaths = [];
        if (legacyPaths) {
            additionalPaths.push('extras');
        } else if (!rootIsSource) {
            additionalPaths.push('src/shared');
        }
        const exclude = legacyPaths ? ['^extras/skip[.]ts$'] : undefined;
        const {swcOptions: projectSwcOptions, directoriesToCompile} = getSwcOptions({
            projectPath: path.join(root, 'src/server'),
            exclude,
            additionalPaths,
            publicPath: '/build/',
        });
        const rootDir = legacyPaths
            ? undefined
            : path.join(root, rootIsSource ? 'src/server' : 'src');
        const outputPath = path.join(root, 'src/server/dist');
        const ignoredFile = rootIsSource ? 'ignored.json' : '**/ignored.json';
        const {sourceOptions, swcOptions} = await loadSwcCli(directoriesToCompile, {
            swcOptions: projectSwcOptions,
            rootDir,
            outputPath,
            exclude,
            ignore: [ignorePattern ?? ignoredFile, '**/tsconfig*.json', fixturesPattern],
        });
        const cliOptions = {
            ...sourceOptions,
            outDir: outputPath,
            copyFiles,
            watch,
            sync: false,
            workers: 2,
        };
        const child = spawn(
            process.execPath,
            [
                '-e',
                `const {swcDir} = require(${JSON.stringify(require.resolve('@swc/cli'))});
                swcDir({
                    cliOptions: ${JSON.stringify(cliOptions)},
                    swcOptions: ${JSON.stringify(swcOptions)},
                    callbacks: {
                        onSuccess: result => process.send({type: 'success', ...result}),
                        onWatchReady: () => process.send({type: 'ready'}),
                        onFail: result => { console.error(result); process.exit(1); },
                    },
                }).then(() => { if (!${watch}) process.disconnect(); }).catch(error => {
                    console.error(error); process.exit(1);
                });`,
            ],
            {
                cwd: rootDir ?? root,
                stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
                timeout: watch ? 9000 : 4000,
            },
        );
        let errors = '';
        child.stderr?.on('data', (data) => {
            errors += data;
        });
        const messages: {type: string; filename?: string; copied?: number}[] = [];
        child.on('message', (message) => messages.push(message as (typeof messages)[number]));
        const exited = once(child, 'exit');
        return {child, messages, exited, errors: () => errors, outputPath, sourceOptions};
    }

    async function waitFor(check: () => boolean) {
        for (let i = 0; i < 150; i++) {
            if (check()) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(check()).toBe(true);
    }

    it.each([false, true])('keeps the layout with copyFiles: %s', async (copyFiles) => {
        const run = await start({copyFiles});
        try {
            expect(run.sourceOptions.filenames).toContain(path.join(root, 'src/server/data.json'));
            expect(await run.exited).toEqual([0, null]);
            expect(run.errors()).toBe('');
            const output = fs.readFileSync(path.join(run.outputPath, 'server/index.js'), 'utf8');
            expect(output).toContain('require("../shared/value")');
            expect(fs.existsSync(path.join(run.outputPath, 'shared/value.js'))).toBe(true);
            const dataFile = path.join(run.outputPath, 'server/data.json');
            expect(fs.existsSync(dataFile)).toBe(copyFiles);
            if (copyFiles) {
                expect(JSON.parse(fs.readFileSync(dataFile, 'utf8'))).toEqual({count: 2});
            }
            expect(fs.existsSync(path.join(run.outputPath, 'server/styles.css'))).toBe(copyFiles);
            for (const file of [
                'fixtures/skipped.json',
                'ignored.json',
                'tsconfig.json',
                'dist/old.json',
                '.cache/old.json',
            ]) {
                expect(fs.existsSync(path.join(run.outputPath, 'server', file))).toBe(false);
            }
        } finally {
            if (run.child.exitCode === null) {
                run.child.kill();
                await run.exited;
            }
        }
    });

    it('skips declaration files from tsconfig paths', async () => {
        const store = path.join(root, 'store/node_modules/@example/tools');
        await fs.promises.mkdir(path.join(store, 'types/schemas'), {recursive: true});
        await fs.promises.writeFile(
            path.join(store, 'types/schemas/index.d.ts'),
            'export type Schema = {name: string};',
        );
        const modules = path.join(root, 'src/shared/node_modules/@example');
        await fs.promises.mkdir(modules, {recursive: true});
        await fs.promises.symlink(store, path.join(modules, 'tools'));
        await fs.promises.writeFile(
            path.join(root, 'src/server/tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    module: 'commonjs',
                    paths: {
                        'shared/*': ['../shared/*'],
                        '@example/tools/schemas': [
                            '../shared/node_modules/@example/tools/types/schemas/index.d.ts',
                        ],
                    },
                },
            }),
        );
        await fs.promises.writeFile(
            path.join(root, 'src/server/index.ts'),
            [
                "import type {Schema} from '@example/tools/schemas';",
                "import {value} from 'shared/value';",
                'export const schema: Schema = {name: String(value)};',
            ].join('\n'),
        );
        const run = await start({copyFiles: false});
        expect(await run.exited).toEqual([0, null]);
        expect(run.errors()).toBe('');
        expect(fs.existsSync(path.join(run.outputPath, 'server/index.js'))).toBe(true);
    });

    it('skips ignored inputs before checking that they are inside rootDir', async () => {
        const external = path.join(root, 'external');
        await fs.promises.mkdir(external);
        await fs.promises.writeFile(path.join(external, 'file.ts'), 'export const value = 1;');
        await fs.promises.symlink(external, path.join(root, 'src/excluded'));
        process.chdir(root);
        const load = (ignore: string[]) =>
            loadSwcCli([path.join(root, 'src/server'), path.join(root, 'src/excluded/file.ts')], {
                swcOptions: {},
                rootDir: path.join(root, 'src'),
                outputPath: path.join(root, 'dist'),
                ignore,
            });
        const {sourceOptions} = await load(['excluded/**']);
        expect(sourceOptions.filenames).toEqual([path.join(root, 'src/server')]);
        process.chdir(root);
        await expect(load([])).rejects.toThrow('is outside server.swcOptions.rootDir');
    });

    it('keeps the project directory as the SWC config root', async () => {
        process.chdir(root);
        const {swcOptions} = await loadSwcCli([path.join(root, 'src/server')], {
            swcOptions: {minify: true},
            rootDir: path.join(root, 'src'),
            outputPath: path.join(root, 'dist'),
        });
        expect(process.cwd()).toBe(path.join(root, 'src'));
        expect(swcOptions).toMatchObject({minify: true, root});
    });

    it('rejects a build without compiled server files', async () => {
        process.chdir(root);
        await expect(
            compile({
                projectPath: path.join(root, 'src/server'),
                outputPath: path.join(root, 'dist'),
                rootDir: path.join(root, 'src'),
                ignore: ['**'],
                publicPath: '/build/',
                logger: new Logger('test'),
            }),
        ).rejects.toThrow('No server files were compiled');
    });

    it.each([
        ['globstar', undefined, undefined],
        ['relative', 'server/ignored.json', undefined],
        ['parentheses', 'server/ignored.json', undefined],
        ['dot-relative', './server/ignored.json', undefined],
        ['directory', undefined, '**/fixtures'],
        ['trailing slash', undefined, 'server/fixtures/'],
    ])(
        'copies assets and removes deleted files with %s ignores',
        async (kind, ignorePattern, fixturesPattern) => {
            if (kind === 'parentheses') {
                const renamed = `${root}(test)`;
                await fs.promises.rename(root, renamed);
                root = renamed;
            }
            const run = await start({copyFiles: true, watch: true, ignorePattern, fixturesPattern});
            try {
                await waitFor(() => run.messages.some((message) => message.type === 'ready'));
                const source = path.join(root, 'src/server');
                const output = path.join(run.outputPath, 'server');
                expect(fs.existsSync(path.join(output, 'ignored.json'))).toBe(false);
                expect(fs.existsSync(path.join(output, 'fixtures'))).toBe(false);
                await fs.promises.writeFile(path.join(source, 'ignored.json'), '{"changed":true}');
                await fs.promises.writeFile(
                    path.join(source, 'fixtures/skipped.json'),
                    '{"changed":true}',
                );
                await fs.promises.writeFile(path.join(source, 'fixtures/added.json'), '{}');
                await fs.promises.writeFile(
                    path.join(source, 'fixtures/added.ts'),
                    'export const value = 1;',
                );
                await fs.promises.writeFile(path.join(source, 'data.json'), '{"count":3}');
                await waitFor(() =>
                    fs.readFileSync(path.join(output, 'data.json'), 'utf8').includes('3'),
                );
                await waitFor(() =>
                    run.messages.some(
                        (message) =>
                            message.copied === 1 && message.filename?.endsWith('data.json'),
                    ),
                );
                await fs.promises.writeFile(path.join(source, 'added.json'), '{}');
                await waitFor(() => fs.existsSync(path.join(output, 'added.json')));
                await fs.promises.unlink(path.join(source, 'added.json'));
                await waitFor(() => !fs.existsSync(path.join(output, 'added.json')));
                await new Promise((resolve) => setTimeout(resolve, 100));
                expect(fs.existsSync(path.join(output, 'ignored.json'))).toBe(false);
                expect(fs.existsSync(path.join(output, 'fixtures'))).toBe(false);
                expect(fs.existsSync(path.join(output, 'dist'))).toBe(false);
                expect(run.errors()).toBe('');
            } finally {
                run.child.kill();
                await run.exited;
            }
        },
        10000,
    );

    it('keeps relative ignores effective when watching rootDir itself', async () => {
        await fs.promises.writeFile(
            path.join(root, 'src/server/tsconfig.json'),
            JSON.stringify({compilerOptions: {module: 'commonjs', target: 'es2019'}}),
        );
        const run = await start({copyFiles: true, watch: true, rootIsSource: true});
        try {
            await waitFor(() => run.messages.some((message) => message.type === 'ready'));
            const ignoredOutput = path.join(run.outputPath, 'ignored.json');
            expect(fs.existsSync(ignoredOutput)).toBe(false);
            await fs.promises.writeFile(
                path.join(root, 'src/server/ignored.json'),
                '{"changed":true}',
            );
            await fs.promises.writeFile(path.join(root, 'src/server/data.json'), '{"count":3}');
            await waitFor(() =>
                fs.readFileSync(path.join(run.outputPath, 'data.json'), 'utf8').includes('3'),
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(fs.existsSync(ignoredOutput)).toBe(false);
            expect(fs.existsSync(path.join(run.outputPath, 'dist'))).toBe(false);
            expect(run.errors()).toBe('');
        } finally {
            run.child.kill();
            await run.exited;
        }
    }, 10000);

    it('preserves anchored exclusions for relative additionalPaths in watch mode', async () => {
        const run = await start({copyFiles: false, watch: true, legacyPaths: true});
        try {
            await waitFor(() => run.messages.some((message) => message.type === 'ready'));
            const skipped = path.join(run.outputPath, 'skip.js');
            const kept = path.join(run.outputPath, 'keep.js');
            expect(fs.existsSync(skipped)).toBe(false);
            expect(fs.existsSync(kept)).toBe(true);
            await fs.promises.writeFile(
                path.join(root, 'extras/skip.ts'),
                'export const value = 2;',
            );
            await fs.promises.writeFile(
                path.join(root, 'extras/keep.ts'),
                'export const value = 2;',
            );
            await waitFor(() => fs.readFileSync(kept, 'utf8').includes('value = 2'));
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(fs.existsSync(skipped)).toBe(false);
            expect(run.errors()).toBe('');
        } finally {
            run.child.kill();
            await run.exited;
        }
    }, 10000);

    it('preserves logical source paths inside a symlinked rootDir', async () => {
        const source = path.join(root, 'src');
        const alias = path.join(root, 'alias');
        await fs.promises.rename(path.join(source, 'server'), path.join(source, 'backend'));
        await fs.promises.symlink(path.join(source, 'backend'), path.join(source, 'server'));
        await fs.promises.symlink(source, alias);
        expect(getSwcCliSourceOptions([path.join(source, 'server')], alias).filenames).toEqual([
            path.join(source, 'server'),
        ]);
        expect(getSwcCliSourceOptions([path.join(alias, 'server')], alias).filenames).toEqual([
            path.join(source, 'server'),
        ]);
        const run = await start({copyFiles: true});
        try {
            expect(await run.exited).toEqual([0, null]);
            expect(fs.existsSync(path.join(run.outputPath, 'server/index.js'))).toBe(true);
            expect(fs.existsSync(path.join(run.outputPath, 'backend/index.js'))).toBe(false);
            expect(run.errors()).toBe('');
        } finally {
            if (run.child.exitCode === null) {
                run.child.kill();
                await run.exited;
            }
        }
    });

    it.each(['/app/**', 'C:/app/**', '../outside/**', 'src/../outside/**', '!src/**', ''])(
        'rejects unsupported ignore %j',
        (pattern) => {
            expect(() => getIgnoredGlobs(path.join(root, 'dist'), [pattern])).toThrow(
                'relative globs without negation or parent traversal',
            );
        },
    );

    it('rejects regex exclusions with rootDir', async () => {
        await expect(
            loadSwcCli([path.join(root, 'src/server')], {
                swcOptions: {},
                rootDir: path.join(root, 'src'),
                outputPath: path.join(root, 'dist'),
                exclude: '^server/skip[.]ts$',
            }),
        ).rejects.toThrow('exclude cannot be combined with rootDir');
    });

    it('rejects a rootDir source on another Windows drive', () => {
        const relative = jest.spyOn(path, 'relative').mockImplementation(path.win32.relative);
        const isAbsolute = jest.spyOn(path, 'isAbsolute').mockImplementation(path.win32.isAbsolute);
        try {
            expect(() => getSwcCliSourceOptions(['D:\\shared'], 'C:\\app\\src')).toThrow('outside');
        } finally {
            relative.mockRestore();
            isAbsolute.mockRestore();
        }
    });

    it('rejects directories outside rootDir and keeps rootDir itself', () => {
        expect(
            getSwcCliSourceOptions(['/app/src', '/app/src/server'], '/app/src').filenames,
        ).toEqual(['/app/src', '/app/src/server']);
        expect(() => getSwcCliSourceOptions(['/app/lib'], '/app/src')).toThrow('/app/lib');
    });
});
