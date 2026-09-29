import {spawn} from 'node:child_process';
import {once} from 'node:events';
import * as fs from 'node:fs';
import {createRequire} from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import {jest} from '@jest/globals';

import {getSwcCliSourceOptions, getSwcOptions, loadSwcCli} from './utils.js';

const require = createRequire(path.join(process.cwd(), 'package.json'));

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
                    paths: {'shared/*': ['../shared/*'], ignored: ['./ignored.json']},
                },
            }),
            'src/server/index.ts': [
                "import {value} from 'shared/value';",
                "import data from './data.json';",
                'export const sum = value + data.count;',
            ].join('\n'),
            'src/server/data.json': JSON.stringify({count: 2}),
            'src/server/fixtures/skipped.json': '{}',
            'src/server/regex-only/keep.ts': 'export const value = 1;',
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
        directFile = false,
        rootIsSource = false,
        legacyPaths = false,
        absoluteIgnore = false,
    }: {
        copyFiles: boolean;
        watch?: boolean;
        directFile?: boolean;
        rootIsSource?: boolean;
        legacyPaths?: boolean;
        absoluteIgnore?: boolean;
    }) {
        process.chdir(root);
        const additionalPaths = [];
        if (legacyPaths) {
            additionalPaths.push('extras');
        } else if (!rootIsSource) {
            additionalPaths.push('src/shared');
        }
        const {swcOptions, directoriesToCompile} = getSwcOptions({
            projectPath: path.join(root, 'src/server'),
            exclude: ['/regex-only/$', ...(legacyPaths ? ['^extras/skip[.]ts$'] : [])],
            additionalPaths,
            publicPath: '/build/',
        });
        const rootDir = legacyPaths
            ? undefined
            : path.join(root, rootIsSource ? 'src/server' : 'src');
        const outputPath = path.join(root, 'src/server/dist');
        const ignoredFile = rootIsSource ? 'ignored.json' : '**/ignored.json';
        const {sourceOptions} = await loadSwcCli(
            directFile ? [path.join(root, 'src/server/data.json')] : directoriesToCompile,
            {
                rootDir,
                outputPath,
                ignore: [
                    absoluteIgnore ? path.join(root, 'src/server/ignored.json') : ignoredFile,
                    '**/tsconfig*.json',
                    '**/fixtures/**',
                ],
            },
        );
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
        return {child, messages, exited, errors: () => errors, outputPath};
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
            expect(await run.exited).toEqual([0, null]);
            expect(run.errors()).toBe('');
            const output = fs.readFileSync(path.join(run.outputPath, 'server/index.js'), 'utf8');
            expect(output).toContain('require("../shared/value")');
            expect(fs.existsSync(path.join(run.outputPath, 'shared/value.js'))).toBe(true);
            expect(fs.existsSync(path.join(run.outputPath, 'server/data.json'))).toBe(copyFiles);
            expect(fs.existsSync(path.join(run.outputPath, 'server/styles.css'))).toBe(copyFiles);
            for (const file of [
                'fixtures/skipped.json',
                'ignored.json',
                'tsconfig.json',
                'dist/old.json',
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

    it.each([false, true])(
        'leaves directory-only regex exclusions to SWC with watch: %s',
        async (watch) => {
            const run = await start({copyFiles: true, watch});
            try {
                if (watch) {
                    await waitFor(() => run.messages.some((message) => message.type === 'ready'));
                } else {
                    expect(await run.exited).toEqual([0, null]);
                }
                const output = path.join(run.outputPath, 'server/regex-only/keep.js');
                expect(fs.readFileSync(output, 'utf8')).toContain('value = 1');
                if (watch) {
                    await fs.promises.writeFile(
                        path.join(root, 'src/server/regex-only/keep.ts'),
                        'export const value = 2;',
                    );
                    await waitFor(() => fs.readFileSync(output, 'utf8').includes('value = 2'));
                }
                expect(run.errors()).toBe('');
            } finally {
                if (run.child.exitCode === null) {
                    run.child.kill();
                    await run.exited;
                }
            }
        },
        10000,
    );

    it('copies a file used directly as a paths target', async () => {
        const run = await start({copyFiles: true, directFile: true});
        try {
            expect(await run.exited).toEqual([0, null]);
            expect(
                JSON.parse(fs.readFileSync(path.join(run.outputPath, 'server/data.json'), 'utf8')),
            ).toEqual({count: 2});
        } finally {
            if (run.child.exitCode === null) {
                run.child.kill();
                await run.exited;
            }
        }
    });

    it('copies additions and updates, removes deletions, and ignores assets in watch mode', async () => {
        const run = await start({copyFiles: true, watch: true});
        try {
            await waitFor(() => run.messages.some((message) => message.type === 'ready'));
            const source = path.join(root, 'src/server');
            const output = path.join(run.outputPath, 'server');
            await fs.promises.writeFile(path.join(source, 'ignored.json'), '{"changed":true}');
            await fs.promises.writeFile(path.join(source, 'fixtures/added.json'), '{}');
            await fs.promises.writeFile(path.join(source, 'data.json'), '{"count":3}');
            await waitFor(() =>
                fs.readFileSync(path.join(output, 'data.json'), 'utf8').includes('3'),
            );
            await waitFor(() =>
                run.messages.some(
                    (message) => message.copied === 1 && message.filename?.endsWith('data.json'),
                ),
            );
            await fs.promises.writeFile(path.join(source, 'added.json'), '{}');
            await waitFor(() => fs.existsSync(path.join(output, 'added.json')));
            await fs.promises.unlink(path.join(source, 'added.json'));
            await waitFor(() => !fs.existsSync(path.join(output, 'added.json')));
            expect(fs.existsSync(path.join(output, 'ignored.json'))).toBe(false);
            expect(fs.existsSync(path.join(output, 'fixtures/added.json'))).toBe(false);
            expect(fs.existsSync(path.join(output, 'dist'))).toBe(false);
            expect(run.errors()).toBe('');
        } finally {
            run.child.kill();
            await run.exited;
        }
    }, 10000);

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
            'server',
        ]);
        expect(getSwcCliSourceOptions([path.join(alias, 'server')], alias).filenames).toEqual([
            'server',
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

    it('honors absolute ignores for direct files and watch updates', async () => {
        const run = await start({copyFiles: true, watch: true, absoluteIgnore: true});
        try {
            await waitFor(() => run.messages.some((message) => message.type === 'ready'));
            const ignored = path.join(run.outputPath, 'server/ignored.json');
            expect(fs.existsSync(ignored)).toBe(false);
            await fs.promises.writeFile(
                path.join(root, 'src/server/ignored.json'),
                '{"changed":true}',
            );
            await fs.promises.writeFile(path.join(root, 'src/server/data.json'), '{"count":5}');
            await waitFor(() =>
                fs
                    .readFileSync(path.join(run.outputPath, 'server/data.json'), 'utf8')
                    .includes('5'),
            );
            expect(fs.existsSync(ignored)).toBe(false);
            expect(run.errors()).toBe('');
        } finally {
            run.child.kill();
            await run.exited;
        }
    }, 10000);

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
        ).toEqual([process.cwd(), 'server']);
        expect(() => getSwcCliSourceOptions(['/app/lib'], '/app/src')).toThrow('/app/lib');
    });
});
