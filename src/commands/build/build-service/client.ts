import {clientCompile} from '../../../common/webpack/compile.js';

import type {NormalizedServiceConfig} from '../../../common/models/index.js';

export function buildClient(config: NormalizedServiceConfig): Promise<void> {
    return clientCompile(config.client, config.configPath);
}
