import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {createRequire} from 'node:module';
import {jest} from '@jest/globals';

import {getIgnoreGlobs} from './utils.js';
import type {Logger} from '../logger/index.js';

// The real glob and watch matchers of @swc/cli: swcDir itself leaves worker threads running under jest.
const swcCli = createRequire(import.meta.url).resolve('@swc/cli');
const swcRequire = createRequire(swcCli);
const {globSources} = swcRequire(path.join(path.dirname(swcCli), 'sources.js'));
const {minimatch} = swcRequire('minimatch');

// The app lives in a `tests` directory and imports ../other/ through tsconfig paths.
const FILES = [
    'tests/app/src/server/index.ts',
    'tests/other/package.json',
    'tests/other/node_modules/dep/index.js',
    'tests/other/src/a.ts',
    'tests/other/src/a.test.ts',
    'tests/other/src/data.json',
];

describe('getIgnoreGlobs', () => {
    let root: string;
    let cwd: string;
    let directories: string[];

    beforeAll(async () => {
        cwd = process.cwd();
        root = await fs.promises.realpath(
            await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-builder-swc-')),
        );
        for (const file of FILES) {
            await fs.promises.mkdir(path.dirname(path.join(root, file)), {recursive: true});
            await fs.promises.writeFile(path.join(root, file), '');
        }
        process.chdir(path.join(root, 'tests/app'));
        directories = [path.join(root, 'tests/app/src/server'), path.join(root, 'tests/other')];
    });

    afterAll(async () => {
        process.chdir(cwd);
        await fs.promises.rm(root, {recursive: true, force: true});
    });

    const relative = (files: string[]) =>
        files
            .map((file) => path.relative(root, path.resolve(file)).split(path.sep).join('/'))
            .sort();

    it('skips ignored files, package manifests and dependencies when globbing', async () => {
        const ignore = getIgnoreGlobs(directories, ['../other/src/**/*.test.ts', '**/tests/**']);
        expect(relative(await globSources(directories, [], ignore))).toEqual([
            'tests/app/src/server/index.ts',
            'tests/other/src/a.ts',
            'tests/other/src/data.json',
        ]);
    });

    it('matches the same files when watching absolute paths', () => {
        const ignore = getIgnoreGlobs(directories, ['../other/src/**/*.test.ts', '**/tests/**']);
        const ignored = FILES.filter((file) =>
            ignore.some((pattern) => minimatch(path.join(root, file), pattern)),
        );
        expect(ignored).toEqual([
            'tests/other/package.json',
            'tests/other/node_modules/dep/index.js',
            'tests/other/src/a.test.ts',
        ]);
    });
});

describe('compile', () => {
    it('fails when no files are found', async () => {
        jest.unstable_mockModule('@swc/cli', () => ({swcDir: async () => {}}));
        const {compile} = await import('./compile.js');
        const logger = {message: () => {}, success: () => {}, error: () => {}} as unknown as Logger;
        await expect(
            compile({logger, projectPath: process.cwd(), outputPath: os.tmpdir(), publicPath: '/'}),
        ).rejects.toThrow('No server files were compiled');
    });
});
