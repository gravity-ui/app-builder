import { NormalizedClientConfig } from '../models';
import type { Logger } from '../logger';
export declare function createS3UploadPlugins(config: NormalizedClientConfig, logger?: Logger): (false | "" | 0 | ((this: import("webpack").Compiler, compiler: import("webpack").Compiler) => void) | import("webpack").WebpackPluginInstance | null)[];
