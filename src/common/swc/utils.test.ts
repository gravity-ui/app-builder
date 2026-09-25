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

    async function getClassFieldsMode(compilerOptions: Record<string, unknown>) {
        await fs.promises.writeFile(
            path.join(projectPath, 'tsconfig.json'),
            JSON.stringify({compilerOptions: {module: 'commonjs', ...compilerOptions}}),
        );
        const {swcOptions} = getSwcOptions({projectPath, publicPath: '/build/'});
        return swcOptions.jsc?.transform?.useDefineForClassFields;
    }

    it('assigns class fields like TypeScript for targets without native class fields', async () => {
        await expect(getClassFieldsMode({target: 'es2019'})).resolves.toBe(false);
    });

    it('defines class fields like TypeScript for ES2022 and later', async () => {
        await expect(getClassFieldsMode({target: 'es2022'})).resolves.toBe(true);
        await expect(getClassFieldsMode({target: 'ESNext'})).resolves.toBe(true);
    });

    it('respects an explicit useDefineForClassFields', async () => {
        await expect(
            getClassFieldsMode({target: 'es2019', useDefineForClassFields: true}),
        ).resolves.toBe(true);
    });

    it('keeps fields set by a base constructor', async () => {
        await getClassFieldsMode({target: 'es2019'});
        const {swcOptions} = getSwcOptions({projectPath, publicPath: '/build/'});
        const {code} = transformSync(SOURCE, {
            ...swcOptions,
            exclude: undefined,
            sourceMaps: false,
            filename: path.join(projectPath, 'child.ts'),
        });
        const context = {exports: {} as {Child: new () => {value: string}}, require: () => ({})};
        vm.runInNewContext(code, context);

        expect(new context.exports.Child().value).toBe('set by base');
    });
});
