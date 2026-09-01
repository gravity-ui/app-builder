import type {Bundler} from '../models/index.js';

export function getByDependencyResolveOptions(bundler: Bundler) {
    if (bundler !== 'rspack') {
        return undefined;
    }

    return {
        unknown: {
            conditionNames: ['import', 'require', 'module', '...'],
        },
    };
}
