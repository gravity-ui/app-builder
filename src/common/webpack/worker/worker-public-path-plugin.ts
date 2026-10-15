import type {Compiler} from 'webpack';

const pluginName = 'WorkerPublicPathPlugin';

export class WorkerPublicPathPlugin {
    apply(compiler: Compiler) {
        const {RuntimeGlobals, RuntimeModule} = compiler.webpack;

        class WorkerPublicPathRuntimeModule extends RuntimeModule {
            constructor() {
                // Run after the default public path, but before startup chunk loading.
                super('worker public path', RuntimeModule.STAGE_ATTACH);
            }

            generate() {
                return `if (typeof self.__PUBLIC_PATH__ === "string") {
    ${RuntimeGlobals.publicPath} = self.__PUBLIC_PATH__;
}`;
            }
        }

        compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
            compilation.hooks.runtimeRequirementInTree
                .for(RuntimeGlobals.publicPath)
                .tap({name: pluginName, stage: -100}, (chunk) => {
                    if (chunk.getEntryOptions()?.chunkLoading === 'import-scripts') {
                        compilation.addRuntimeModule(chunk, new WorkerPublicPathRuntimeModule());
                    }
                });
        });
    }
}
