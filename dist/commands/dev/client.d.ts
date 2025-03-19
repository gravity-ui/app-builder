import WebpackDevServer from 'webpack-dev-server';
import { RspackDevServer } from '@rspack/dev-server';
import type { NormalizedServiceConfig } from '../../common/models';
export declare function watchClientCompilation(config: NormalizedServiceConfig, onManifestReady: () => void): Promise<WebpackDevServer<import("express").Application, import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>> | RspackDevServer>;
