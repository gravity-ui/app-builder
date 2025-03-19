import * as webpack from 'webpack';
import type * as Rspack from '@rspack/core';
import type { NormalizedClientConfig } from '../models';
import type { Logger } from '../logger';
export interface HelperOptions {
    config: NormalizedClientConfig;
    logger?: Logger;
    isEnvDevelopment: boolean;
    isEnvProduction: boolean;
    configType: `${WebpackMode}`;
    buildDirectory: string;
    entriesDirectory: string;
    isSsr: boolean;
}
export declare const enum WebpackMode {
    Prod = "production",
    Dev = "development"
}
type ClientFactoryOptions = {
    webpackMode: WebpackMode;
    config: NormalizedClientConfig;
    logger?: Logger;
    isSsr?: boolean;
};
export declare function webpackConfigFactory(options: ClientFactoryOptions): Promise<webpack.Configuration>;
export declare function rspackConfigFactory(options: ClientFactoryOptions): Promise<Rspack.Configuration>;
export declare function configureModuleRules(helperOptions: HelperOptions, additionalRules?: NonNullable<webpack.RuleSetRule['oneOf']>): Promise<webpack.RuleSetRule[]>;
export declare function configureResolve({ isEnvProduction, config }: HelperOptions): {
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
type Optimization = NonNullable<webpack.Configuration['optimization']>;
export declare function configureOptimization(helperOptions: HelperOptions): Optimization;
export {};
