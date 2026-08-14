import * as babel from '@babel/core';

import {babelPreset, libraryBabelPreset} from './index.js';
import uiPreset from './ui-preset.js';

import type {PluginItem} from '@babel/core';

function executablePreset(
    preset: ReturnType<typeof babelPreset> | ReturnType<typeof libraryBabelPreset>,
): PluginItem {
    return [uiPreset, preset[1]] as PluginItem;
}

describe('babelPreset', () => {
    it('always uses the automatic JSX runtime', () => {
        const result = babel.transformSync('export const Example = () => <div />;', {
            babelrc: false,
            configFile: false,
            filename: 'Example.tsx',
            presets: [executablePreset(babelPreset({}))],
        });

        expect(result?.code).toContain('react/jsx');
        expect(result?.code).not.toContain('React.createElement');
    });
});

describe('libraryBabelPreset', () => {
    it('only strips TypeScript and transforms JSX without runtime helpers or polyfills', () => {
        const source = `
            interface Props {
                value: string;
                extra?: string;
            }

            export async function Example({value, ...rest}: Props) {
                const result = await Promise.resolve({
                    ...rest,
                    values: Object.values({value}),
                });
                const [first] = result.values;

                return <div>{first}</div>;
            }
        `;

        const result = babel.transformSync(source, {
            babelrc: false,
            configFile: false,
            filename: 'Example.tsx',
            presets: [executablePreset(libraryBabelPreset())],
        });

        expect(result?.code).toContain('export async function Example');
        expect(result?.code).toContain('...rest');
        expect(result?.code).toContain('const [first]');
        expect(result?.code).toContain('Object.values');
        expect(result?.code).toContain('react/jsx');
        expect(result?.code).not.toContain('@babel/runtime');
        expect(result?.code).not.toContain('core-js');
        expect(result?.code).not.toContain('interface Props');
    });
});
