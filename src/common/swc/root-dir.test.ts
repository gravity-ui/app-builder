import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';

import {getSwcOptions, loadSwcCli} from './utils.js';

describe('SWC rootDir compilation', () => {
    const cwd = process.cwd();
    let tmp: string;
    let outputPath: string;
    let globbed: string[];

    beforeAll(async () => {
        tmp = fs.realpathSync(
            await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-builder-root-dir-')),
        );
        const root = path.join(tmp, 'node_modules/app[copy]');
        const files: Record<string, string> = {
            '.swcrc': JSON.stringify({minify: true}),
            'src/server/tsconfig.json': JSON.stringify({
                compilerOptions: {module: 'commonjs', paths: {value: ['./nested/value.ts']}},
            }),
            'src/server/index.ts': 'export const value = () => {\n    return 1;\n};',
            'src/server/nested/.swcrc': '{}',
            'src/server/nested/value.ts': 'export const nested = () => {\n    return 1;\n};',
            'src/server/node_modules/dep/index.ts': 'export const dep = 1;',
        };
        for (const [file, content] of Object.entries(files)) {
            await fs.promises.mkdir(path.dirname(path.join(root, file)), {recursive: true});
            await fs.promises.writeFile(path.join(root, file), content);
        }
        process.chdir(root);
        outputPath = path.join(root, 'dist');
        const {swcOptions: projectSwcOptions, directoriesToCompile} = getSwcOptions({
            projectPath: path.join(root, 'src/server'),
            publicPath: '/build/',
        });
        const {swcDir, sourceOptions, swcOptions} = await loadSwcCli(directoriesToCompile, {
            swcOptions: projectSwcOptions,
            rootDir: path.join(root, 'src'),
            outputPath,
        });
        // @ts-ignore @swc/cli is not typed
        const {default: sources} = await import('@swc/cli/lib/swc/sources.js');
        globbed = await sources.globSources(sourceOptions.filenames, [], sourceOptions.ignore);
        await swcDir({
            cliOptions: {
                ...sourceOptions,
                outDir: outputPath,
                watch: false,
                sync: true,
                quiet: true,
            },
            swcOptions,
        });
    });

    afterAll(async () => {
        process.chdir(cwd);
        await fs.promises.rm(tmp, {recursive: true, force: true});
    });

    const read = (file: string) => fs.readFileSync(path.join(outputPath, file), 'utf8');

    it('applies the .swcrc above rootDir', () => {
        expect(read('server/index.js')).toContain('"use strict";Object');
    });

    it('prefers a nested .swcrc', () => {
        expect(read('server/nested/value.js')).toContain('"use strict";\n');
    });

    it('excludes only node_modules inside rootDir', () => {
        expect(fs.existsSync(path.join(outputPath, 'server/node_modules'))).toBe(false);
    });

    it('passes each source to SWC once, as an absolute path', () => {
        expect(globbed.every((file) => path.isAbsolute(file))).toBe(true);
        expect(new Set(globbed).size).toBe(globbed.length);
        expect(globbed.filter((file) => file.endsWith('value.ts'))).toHaveLength(1);
    });
});
