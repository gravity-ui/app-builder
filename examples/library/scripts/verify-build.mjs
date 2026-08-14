import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
    try {
        return await readFile(path.join(packageDirectory, relativePath), 'utf8');
    } catch (error) {
        throw new Error(`Expected build artifact ${relativePath}: ${error.message}`);
    }
}

function expectIncludes(code, expected, file) {
    for (const value of expected) {
        if (!code.includes(value)) {
            throw new Error(`${file} does not contain ${JSON.stringify(value)}`);
        }
    }
}

function expectExcludes(code, forbidden, file) {
    for (const value of forbidden) {
        if (code.includes(value)) {
            throw new Error(`${file} unexpectedly contains ${JSON.stringify(value)}`);
        }
    }
}

const esmFile = 'build/esm/ExampleCard.js';
const cjsFile = 'build/cjs/ExampleCard.js';
const iconFile = 'build/esm/assets/icons/check.js';
const forbiddenTransforms = [
    'core-js/',
    '@babel/runtime/',
    'React.createElement',
    '_asyncToGenerator',
    '_objectSpread',
    '_objectWithoutProperties',
    '_regeneratorRuntime',
    '_slicedToArray',
];

const [esm, cjs, icon, declarations, componentCss, globalCss] = await Promise.all([
    read(esmFile),
    read(cjsFile),
    read(iconFile),
    read('build/esm/ExampleCard.d.ts'),
    read('build/esm/ExampleCard.css'),
    read('build/styles/theme.css'),
]);

expectIncludes(
    esm,
    [
        'react/jsx-runtime',
        "./ExampleCard.css",
        'export async function createExampleCardProps',
        '...rest',
        'Object.values',
        'const [firstTag, ...otherTags]',
    ],
    esmFile,
);
expectExcludes(esm, [...forbiddenTransforms, "from '@/"], esmFile);

expectIncludes(cjs, ['react/jsx-runtime', 'async function createExampleCardProps'], cjsFile);
expectExcludes(cjs, forbiddenTransforms, cjsFile);

expectIncludes(icon, ['react/jsx-runtime'], iconFile);
expectExcludes(icon, forbiddenTransforms, iconFile);

expectIncludes(declarations, ['export interface ExampleCardProps'], 'build/esm/ExampleCard.d.ts');
expectIncludes(componentCss, ['.example-card'], 'build/esm/ExampleCard.css');
expectIncludes(globalCss, ['--example-card-accent'], 'build/styles/theme.css');

console.log('Library example build verified successfully.');
