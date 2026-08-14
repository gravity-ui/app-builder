export {
    configureWebpackConfigForStorybook,
    configureServiceWebpackConfig,
} from './common/webpack/storybook.js';
export * from './common/s3-upload/index.js';
export {createTransformPathsToLocalModules} from './common/typescript/transformers.js';
export {defineConfig} from './common/models/index.js';
export {babelPreset} from './common/babel/index.js';

export type {
    DevServerConfig,
    ProjectConfig,
    ServiceConfig,
    LibraryConfig,
    ModuleFederationConfig,
    ProjectFileConfig,
} from './common/models/index.js';
