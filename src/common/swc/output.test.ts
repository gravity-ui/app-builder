import {once} from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {jest} from '@jest/globals';

import {copyFiles, watchCopiedFiles} from './copy.js';
import {getIgnoredGlobs, getSwcCliSourceOptions, getSwcOptions, loadSwcCli} from './utils.js';

describe('SWC server output', () => {
    const cwd = process.cwd();
    let root: string;

    beforeEach(async () => {
        root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-builder-swc-output-'));
        const files: Record<string, string> = {
            'src/server/tsconfig.json': JSON.stringify({
                compilerOptions: {
                    module: 'commonjs',
                    target: 'es2019',
                    esModuleInterop: true,
                    paths: {'shared/*': ['../shared/*']},
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
            'src/shared/value.ts': 'export const value = 1;',
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

    async function build() {
        const rootDir = path.join(root, 'src');
        const {swcOptions, directoriesToCompile} = getSwcOptions({
            projectPath: path.join(root, 'src/server'),
            exclude: ['/fixtures/'],
            publicPath: '/build/',
        });
        const {swcDir, sourceOptions} = await loadSwcCli(directoriesToCompile, rootDir);
        const outputPath = path.join(root, 'dist');
        const ignore = await getIgnoredGlobs(
            sourceOptions.filenames,
            swcOptions.exclude,
            outputPath,
        );
        await new Promise((resolve, reject) => {
            swcDir({
                // The worker pool of the async mode outlives the test.
                cliOptions: {...sourceOptions, ignore, outDir: outputPath, sync: true},
                swcOptions,
                callbacks: {onSuccess: resolve, onFail: reject},
            });
        });
        const copyOptions = {
            ...sourceOptions,
            extensions: ['.json'],
            exclude: swcOptions.exclude,
            ignore,
            outputPath,
        };
        await copyFiles(copyOptions, {message: jest.fn()} as never);
        return copyOptions;
    }

    // One test: @swc/cli reads the working directory once per process.
    it('keeps the layout under rootDir and copies listed extensions', async () => {
        const copyOptions = await build();

        const output = await fs.promises.readFile(path.join(root, 'dist/server/index.js'), 'utf-8');
        expect(output).toContain('require("../shared/value")');
        expect(fs.existsSync(path.join(root, 'dist/shared/value.js'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'dist/server/data.json'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'dist/server/fixtures/skipped.json'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'dist/server/styles.css'))).toBe(false);
        expect(copyOptions.ignore).toContain('server/fixtures/**');

        const logger = {message: jest.fn(), error: jest.fn()};
        const watcher = watchCopiedFiles(copyOptions, logger as never);
        try {
            await once(watcher, 'ready');
            await fs.promises.writeFile(path.join(root, 'src/server/fixtures/added.json'), '{}');
            await fs.promises.writeFile(path.join(root, 'src/server/data.json'), '{"count": 3}');
            const dest = path.join(root, 'dist/server/data.json');
            for (let i = 0; i < 100 && !fs.readFileSync(dest, 'utf-8').includes('3'); i++) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            expect(JSON.parse(fs.readFileSync(dest, 'utf-8'))).toEqual({count: 3});
            expect(fs.existsSync(path.join(root, 'dist/server/fixtures/added.json'))).toBe(false);
        } finally {
            await watcher.close();
        }
    });

    it('accepts file and missing targets when looking for excluded directories', async () => {
        const targets = [path.join(root, 'src/server/index.ts'), path.join(root, 'missing')];
        await expect(
            getIgnoredGlobs(targets, ['/fixtures/'], path.join(root, 'dist')),
        ).resolves.toHaveLength(4);
    });

    it('rejects directories outside rootDir and keeps rootDir itself', () => {
        expect(
            getSwcCliSourceOptions(['/app/src', '/app/src/server'], '/app/src').filenames,
        ).toEqual([process.cwd(), 'server']);
        expect(() => getSwcCliSourceOptions(['/app/lib'], '/app/src')).toThrow('/app/lib');
    });
});
