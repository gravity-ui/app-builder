declare module 'webpack/lib/node/NodeTargetPlugin' {
    export default class NodeTargetPlugin {
        apply(compiler: import('webpack').Compiler);
    }
}
declare module 'webpack/lib/webworker/WebWorkerTemplatePlugin' {
    export default class WebWorkerTemplatePlugin {
        apply(compiler: import('webpack').Compiler);
    }
}
declare module 'webpack/lib/web/FetchCompileWasmPlugin' {
    export default class FetchCompileWasmPlugin {
        constructor(options?: {mangleImports?: boolean});
        apply(compiler: import('webpack').Compiler);
    }
}
declare module 'webpack/lib/web/FetchCompileAsyncWasmPlugin' {
    export default class FetchCompileAsyncWasmPlugin {
        apply(compiler: import('webpack').Compiler);
    }
}
