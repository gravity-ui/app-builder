export {
    configureWebpackConfigForStorybook,
    configureServiceWebpackConfig,
} from './common/webpack/storybook';
export {createTransformPathsToLocalModules} from './common/typescript/transformers';
export {defineConfig} from './common/models';
export type {ProjectConfig, ServiceConfig, LibraryConfig, ProjectFileConfig} from './common/models';
