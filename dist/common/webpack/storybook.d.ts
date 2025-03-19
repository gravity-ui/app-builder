import { WebpackMode } from './config';
import type { ClientConfig } from '../models';
import type * as Webpack from 'webpack';
type Mode = `${WebpackMode}`;
export declare function configureServiceWebpackConfig(mode: Mode, storybookConfig: Webpack.Configuration): Promise<Webpack.Configuration>;
type ModuleRule = NonNullable<NonNullable<Webpack.Configuration['module']>['rules']>[number];
export declare function configureWebpackConfigForStorybook(mode: Mode, userConfig?: ClientConfig, storybookModuleRules?: ModuleRule[]): Promise<{
    module: {
        rules: Webpack.RuleSetRule[];
    };
    resolve: {
        alias: {
            [x: string]: string | string[];
        };
        modules: string[];
        extensions: string[];
        symlinks: boolean | undefined;
        fallback: {
            [index: string]: string | false | string[];
        } | undefined;
    };
    plugins: (false | "" | 0 | ((this: Webpack.Compiler, compiler: Webpack.Compiler) => void) | Webpack.WebpackPluginInstance | null | undefined)[];
    optimization: {
        minimizer: (false | "" | 0 | Webpack.WebpackPluginInstance | "..." | ((this: Webpack.Compiler, compiler: Webpack.Compiler) => void) | null | undefined)[] | undefined;
    };
}>;
export {};
