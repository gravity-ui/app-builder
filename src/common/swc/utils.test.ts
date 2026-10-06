import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {transformSync} from '@swc/core';

import {getOutputOptions, getSwcOptions} from './utils.js';

const SOURCE = `class Base {
    constructor() {
        this.init();
    }
    init() {}
}
export class Child extends Base {
    value: string;
    init() {
        this.value = 'set by base';
    }
}
`;

describe('getSwcOptions', () => {
    let projectPath: string;

    beforeEach(async () => {
        projectPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'app-builder-swc-'));
    });

    afterEach(async () => {
        await fs.promises.rm(projectPath, {recursive: true, force: true});
    });

    async function getOptions(compilerOptions: Record<string, unknown>) {
        await fs.promises.writeFile(
            path.join(projectPath, 'tsconfig.json'),
            JSON.stringify({compilerOptions: {module: 'commonjs', ...compilerOptions}}),
        );
        return getSwcOptions({projectPath, publicPath: '/build/'}).swcOptions;
    }

    async function getClassFieldsMode(compilerOptions: Record<string, unknown>) {
        return (await getOptions(compilerOptions)).jsc?.transform?.useDefineForClassFields;
    }

    it.each([
        {},
        {target: 'es5'},
        {target: 'es2019'},
        {target: 'es2022'},
        {target: 'ESNext'},
        {module: 'node16'},
        {module: 'node18'},
        {module: 'node20'},
        {module: 'nodenext'},
    ])('preserves define semantics when the setting is omitted: %j', async (compilerOptions) => {
        await expect(getClassFieldsMode(compilerOptions)).resolves.toBe(true);
    });

    it.each([
        ['es2019', true],
        ['es2019', false],
        ['es2022', true],
        ['es2022', false],
    ] as const)(
        'uses the expected own-property behavior for %s with define semantics: %s',
        async (target, useDefineForClassFields) => {
            const swcOptions = await getOptions({target, useDefineForClassFields});
            const {code} = transformSync('export class Model { value?: string; }', {
                ...swcOptions,
                filename: path.join(projectPath, 'model.ts'),
            });
            const context = {
                exports: {} as {Model: new () => {value?: string}},
                require: () => ({}),
            };
            vm.runInNewContext(code, context);

            expect(Object.prototype.hasOwnProperty.call(new context.exports.Model(), 'value')).toBe(
                useDefineForClassFields,
            );
        },
    );

    it.each([undefined, true])(
        'resolves an inherited false setting with local override: %s',
        async (useDefineForClassFields) => {
            await fs.promises.writeFile(
                path.join(projectPath, 'base.json'),
                JSON.stringify({compilerOptions: {useDefineForClassFields: false}}),
            );
            await fs.promises.writeFile(
                path.join(projectPath, 'tsconfig.json'),
                JSON.stringify({
                    extends: './base.json',
                    compilerOptions: {target: 'es2022', useDefineForClassFields},
                }),
            );

            const {swcOptions} = getSwcOptions({projectPath, publicPath: '/build/'});

            expect(swcOptions.jsc?.transform?.useDefineForClassFields).toBe(
                useDefineForClassFields ?? false,
            );
        },
    );

    it('keeps fields set by a base constructor', async () => {
        const swcOptions = await getOptions({target: 'es2019', useDefineForClassFields: false});
        const {code} = transformSync(SOURCE, {
            ...swcOptions,
            filename: path.join(projectPath, 'child.ts'),
        });
        const context = {exports: {} as {Child: new () => {value: string}}, require: () => ({})};
        vm.runInNewContext(code, context);

        expect(new context.exports.Child().value).toBe('set by base');
    });
});

describe('getOutputOptions', () => {
    const cwd = process.cwd();
    const root = path.dirname(cwd);

    it('strips the leading path segment without rootDir', () => {
        expect(getOutputOptions('/dist', [cwd])).toEqual({
            outDir: '/dist',
            stripLeadingPaths: true,
        });
    });

    it('keeps paths relative to rootDir like tsc', () => {
        const sibling = path.join(root, 'sibling/src');
        expect(getOutputOptions('/dist', [cwd, sibling], '..')).toEqual({
            outDir: path.join('/dist', path.basename(cwd)),
            stripLeadingPaths: false,
        });
    });

    it('throws when a source is outside rootDir', () => {
        expect(() => getOutputOptions('/dist', [root], '.')).toThrow(
            /outside server.swcOptions.rootDir/,
        );
    });

    it('skips missing directories', () => {
        expect(getOutputOptions('/dist', [path.join(root, 'missing')], '.').outDir).toBe('/dist');
    });
});
