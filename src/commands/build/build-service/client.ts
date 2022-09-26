import {webpackCompile} from '../../../common/webpack/compile';

import type {NormalizedServiceConfig} from '../../../common/models';

export function buildClient(config: NormalizedServiceConfig): Promise<void> {
    return webpackCompile(config.client);
}
