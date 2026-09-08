import {getByDependencyResolveOptions} from './resolve.js';

describe('dependency resolve configuration', () => {
    it('enables import conditional exports for unknown Rspack dependencies', () => {
        expect(getByDependencyResolveOptions('rspack')).toEqual({
            unknown: {
                conditionNames: ['import', 'require', 'module', '...'],
            },
        });
    });

    it('keeps Webpack dependency conditions unchanged', () => {
        expect(getByDependencyResolveOptions('webpack')).toBeUndefined();
    });
});
