import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'node:url';

import packageJson from '../package.json' with {type: 'json'};

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const typesDir = path.join(projectRoot, 'types');

describe('@gravity-ui/app-builder', () => {
    it('should expose an ESM-only entry point', () => {
        expect(packageJson.type).toBe('module');
        expect(packageJson.exports['.']).toEqual({
            types: './dist/index.d.ts',
            import: './dist/index.js',
        });
        expect(packageJson.exports['.']).not.toHaveProperty('require');
    });
});

describe('@gravity-ui/app-builder/client', () => {
    it('should export client ambient types from package.json', () => {
        expect(packageJson.exports['./client']).toEqual({
            types: './types/client.d.ts',
        });
    });

    it('should have client.d.ts in types directory', () => {
        expect(fs.existsSync(path.join(typesDir, 'client.d.ts'))).toBe(true);
    });
});

describe('@gravity-ui/app-builder/ui', () => {
    it('should export ui ambient types from package.json', () => {
        expect(packageJson.exports['./ui']).toEqual({
            types: './types/ui.d.ts',
        });
    });

    it('should have ui.d.ts in types directory', () => {
        expect(fs.existsSync(path.join(typesDir, 'ui.d.ts'))).toBe(true);
    });

    it('should reference client types', () => {
        const uiTypes = fs.readFileSync(path.join(typesDir, 'ui.d.ts'), 'utf8');
        expect(uiTypes).toContain('/// <reference path="./client.d.ts" />');
    });
});
