import {clientCompile} from '../../../common/webpack/compile';

import type {NormalizedServiceConfig} from '../../../common/models';

export function buildClient(config: NormalizedServiceConfig): Promise<void> {
    return clientCompile(config.client);
}
