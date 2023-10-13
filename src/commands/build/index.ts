import {isLibraryConfig} from '../../common/models';
import type {ProjectConfig} from '../../common/models';

export default async function (config: ProjectConfig) {
    process.env.NODE_ENV = 'production';
    // eslint-disable-next-line security/detect-non-literal-require
    const {default: build} = require(isLibraryConfig(config) ? './build-lib' : './build-service');
    return build(config);
}
