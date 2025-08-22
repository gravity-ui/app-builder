export {
    configureWebpackConfigForStorybook,
    configureServiceWebpackConfig,
} from './common/webpack/storybook';
export * from './common/s3-upload';
export {createTransformPathsToLocalModules} from './common/typescript/transformers';
export {defineConfig} from './common/models';
export {babelPreset} from './common/babel';

export type {
    ProjectConfig,
    ServiceConfig,
    LibraryConfig,
    ModuleFederationConfig,
    ProjectFileConfig,
} from './common/models';
