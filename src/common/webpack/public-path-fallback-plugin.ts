import type webpack from 'webpack';
import {createFallbackController, installChunkFallback} from './fallback-controller.js';
import type {NormalizedClientConfig} from '../models/index.js';
import {hasMFAssetsIsolation} from '../utils.js';

export function getFallbackRuntimeConfig(config: NormalizedClientConfig) {
    const scope = hasMFAssetsIsolation(config.moduleFederation) ? config.moduleFederation.name : '';
    const root = scope
        ? config.browserPublicPath.slice(0, -scope.length - 1)
        : config.browserPublicPath;
    return {
        root,
        scope,
        federated: Boolean(config.moduleFederation),
        fallbacks: config.publicPathFallbacks,
    };
}

export function createPublicPathFallbackPlugin(config: NormalizedClientConfig) {
    const runtimeConfig = getFallbackRuntimeConfig(config);
    return {
        apply(compiler: webpack.Compiler) {
            const {RuntimeModule, RuntimeGlobals} = compiler.webpack;
            class FallbackRuntimeModule extends RuntimeModule {
                constructor() {
                    super('public path fallback', RuntimeModule.STAGE_TRIGGER);
                }
                generate() {
                    return `var controller = (${createFallbackController.toString()})(${JSON.stringify(runtimeConfig)});\n(${installChunkFallback.toString()})(${RuntimeGlobals.require}, controller);`;
                }
            }
            compiler.hooks.thisCompilation.tap('PublicPathFallbackPlugin', (compilation) => {
                compilation.hooks.additionalTreeRuntimeRequirements.tap(
                    'PublicPathFallbackPlugin',
                    (chunk, requirements) => {
                        requirements.add(RuntimeGlobals.publicPath);
                        requirements.add(RuntimeGlobals.ensureChunk);
                        compilation.addRuntimeModule(chunk, new FallbackRuntimeModule());
                    },
                );
            });
        },
    };
}
