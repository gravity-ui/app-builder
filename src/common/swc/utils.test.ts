import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import {transformSync} from '@swc/core';

import {getSwcOptions} from './utils.js';

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

    it('assigns class fields like TypeScript for targets without native class fields', async () => {
        await expect(getClassFieldsMode({target: 'es2019'})).resolves.toBe(false);
    });

    it('defines class fields like TypeScript for ES2022 and later', async () => {
        await expect(getClassFieldsMode({target: 'es2022'})).resolves.toBe(true);
        await expect(getClassFieldsMode({target: 'ESNext'})).resolves.toBe(true);
    });

    it('assigns class fields without a target and TypeScript 5', async () => {
        await expect(getClassFieldsMode({})).resolves.toBe(false);
    });

    it('defines class fields without a target and TypeScript 6, whose default target has them', async () => {
        const typescriptPath = path.join(projectPath, 'node_modules/typescript');
        await fs.promises.mkdir(typescriptPath, {recursive: true});
        await fs.promises.writeFile(
            path.join(typescriptPath, 'package.json'),
            JSON.stringify({name: 'typescript', version: '6.0.3'}),
        );
        await expect(getClassFieldsMode({})).resolves.toBe(true);
    });

    it('respects an explicit useDefineForClassFields', async () => {
        await expect(
            getClassFieldsMode({target: 'es2019', useDefineForClassFields: true}),
        ).resolves.toBe(true);
    });

    it('keeps fields set by a base constructor', async () => {
        const swcOptions = await getOptions({target: 'es2019'});
        const {code} = transformSync(SOURCE, {
            ...swcOptions,
            filename: path.join(projectPath, 'child.ts'),
        });
        const context = {exports: {} as {Child: new () => {value: string}}, require: () => ({})};
        vm.runInNewContext(code, context);

        expect(new context.exports.Child().value).toBe('set by base');
    });
});
