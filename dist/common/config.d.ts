import type { LibraryConfig, NormalizedServiceConfig, ServiceConfig } from './models';
import type { CliArgs } from '../create-cli';
export declare function getProjectConfig(command: string, { env, storybook, ...argv }: Partial<CliArgs> & {
    storybook?: boolean;
}): Promise<LibraryConfig | NormalizedServiceConfig>;
export declare function normalizeConfig(userConfig: ServiceConfig, mode?: 'dev' | 'build' | string): Promise<NormalizedServiceConfig>;
export declare function normalizeConfig(userConfig: LibraryConfig, mode?: 'dev' | 'build' | string): Promise<LibraryConfig>;
