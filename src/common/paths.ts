import * as fs from 'node:fs';
import * as path from 'node:path';

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath: string) => path.resolve(appDirectory, relativePath);

export default {
    app: resolveApp('.'),
    appNodeModules: resolveApp('node_modules'),
    appClient: resolveApp('src/ui'),
    appServer: resolveApp('src/server'),
    appEntry: resolveApp('src/ui/entries'),
    appDist: resolveApp('dist'),
    appRun: resolveApp('dist/run'),
    appBuild: resolveApp('dist/public/build'),
    appSsrBuild: resolveApp('dist/ssr'),
    src: resolveApp('src'),
    libBuild: resolveApp('build'),
    libBuildEsm: resolveApp('build/esm'),
    libBuildCjs: resolveApp('build/cjs'),
    libAssets: resolveApp('assets'),
    libGlobalStyles: resolveApp('styles'),
    libCompiledGlobalStyles: resolveApp('build/styles'),
    libCompiledAssetsEsm: resolveApp('build/esm/assets'),
    libCompiledAssetsCjs: resolveApp('build/cjs/assets'),
};
