"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLibrary = buildLibrary;
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const childProcess = __importStar(require("node:child_process"));
const node_url_1 = require("node:url");
const babel = __importStar(require("@babel/core"));
const fast_glob_1 = require("fast-glob");
const rimraf_1 = require("rimraf");
const sass_embedded_1 = __importDefault(require("sass-embedded"));
const postcss_1 = __importDefault(require("postcss"));
const postcss_preset_env_1 = __importDefault(require("postcss-preset-env"));
const core_1 = require("@svgr/core");
const paths_1 = __importDefault(require("../../common/paths"));
const logger_1 = __importDefault(require("../../common/logger"));
const babel_1 = require("../babel");
function getFilePath(filePath, { ext, dir } = { dir: paths_1.default.src }) {
    let filePathWithExt = filePath;
    if (ext) {
        filePathWithExt = filePath.replace(path.extname(filePath), `.${ext}`);
    }
    return dir ? path.resolve(dir, filePathWithExt) : filePathWithExt;
}
function errorHandlerFactory(msg) {
    return (err) => {
        if (err) {
            if (msg) {
                logger_1.default.error(msg);
            }
            logger_1.default.error(err.toString());
            throw err;
        }
    };
}
function copyToCjs(file, inputDir = paths_1.default.libBuildEsm) {
    const esmFile = getFilePath(file, { dir: inputDir });
    const cjsFile = getFilePath(file, { dir: paths_1.default.libBuildCjs });
    const cjsDir = path.dirname(cjsFile);
    fs.mkdirSync(cjsDir, { recursive: true });
    fs.copyFile(esmFile, cjsFile, errorHandlerFactory(`Failed to copy file to cjs ${esmFile}`));
}
function compileToCjs(code, file, inputSourceMap, sourceDir = paths_1.default.src, compiledDir = paths_1.default.libBuildCjs) {
    const sourceFile = getFilePath(file, { dir: sourceDir });
    const compiledCjsFile = getFilePath(file, { dir: compiledDir, ext: 'js' });
    const compiledCjsDir = path.dirname(compiledCjsFile);
    const sourcemapCjsFile = getFilePath(file, { dir: compiledDir, ext: 'js.map' });
    const sourcemapCjsUrl = `// #sourceMappingURL=${path.basename(sourcemapCjsFile)}`;
    fs.mkdirSync(compiledCjsDir, { recursive: true });
    babel.transform(code, {
        babelrc: false,
        configFile: false,
        filename: sourceFile,
        plugins: [
            require.resolve('@babel/plugin-transform-modules-commonjs'),
            require.resolve('@babel/plugin-transform-dynamic-import'),
        ],
        sourceMaps: true,
        inputSourceMap,
    }, (err, transformedCjs) => {
        if (err) {
            logger_1.default.error(`Source compilation errors for ${sourceFile}`);
            logger_1.default.error(err.toString());
            throw err;
        }
        else if (transformedCjs) {
            let cjsCode = transformedCjs.code ?? '';
            cjsCode += (cjsCode.length ? '\n' : '') + sourcemapCjsUrl;
            fs.writeFile(compiledCjsFile, cjsCode, errorHandlerFactory(`Source compilation has failed on writing ${compiledCjsFile}`));
            if (transformedCjs.map) {
                fs.writeFile(sourcemapCjsFile, JSON.stringify(transformedCjs.map), errorHandlerFactory(`Source compilation has failed on writing ${sourcemapCjsFile}`));
            }
        }
    });
}
function compileStyles(inputDir, outputDir, onFinish, additionalGlobs = []) {
    const origStylesStream = (0, fast_glob_1.globStream)(['**/*.{sass,scss,css}', ...additionalGlobs], {
        cwd: inputDir,
    });
    origStylesStream.on('data', (file) => {
        const origScssFile = getFilePath(file, { dir: inputDir });
        const scssFile = getFilePath(file, { dir: outputDir });
        const scssDir = path.dirname(scssFile);
        fs.mkdirSync(scssDir, { recursive: true });
        if (origScssFile !== scssFile) {
            const content = fs
                .readFileSync(origScssFile, 'utf-8')
                .replace(/url\(([.]*)..\/assets\//g, 'url($1../../assets/');
            fs.writeFileSync(scssFile, content);
        }
    });
    origStylesStream.on('finish', () => {
        const globs = outputDir === paths_1.default.libBuildEsm
            ? ['**/*.{sass,scss,css}', '!cjs/**/*']
            : ['**/*.{sass,scss,css}'];
        const stylesStream = (0, fast_glob_1.globStream)(globs, { cwd: outputDir });
        stylesStream.on('data', async (file) => {
            const origScssFile = getFilePath(file, { dir: inputDir });
            const scssFile = getFilePath(file, { dir: outputDir });
            const cssFile = getFilePath(file, { dir: outputDir, ext: 'css' });
            const sourceMapFile = getFilePath(file, { dir: outputDir, ext: 'css.map' });
            try {
                const sassTransformed = await sass_embedded_1.default.compileAsync(scssFile, {
                    sourceMap: true,
                    sourceMapIncludeSources: true,
                    importers: [
                        {
                            findFileUrl(url) {
                                if (url.startsWith('~')) {
                                    return (0, node_url_1.pathToFileURL)(getFilePath(url.substring(1), { dir: paths_1.default.appNodeModules }));
                                }
                                throw new Error(`Unrecognized import ${url} in ${origScssFile}`);
                            },
                        },
                    ],
                });
                if (sassTransformed.css) {
                    const sourceMap = sassTransformed.sourceMap;
                    if (sourceMap) {
                        sourceMap.sources = sourceMap.sources.map((url) => {
                            return path.relative(path.dirname(scssFile), (0, node_url_1.fileURLToPath)(url));
                        });
                    }
                    const postcssTransformed = await (0, postcss_1.default)([
                        (0, postcss_preset_env_1.default)({ enableClientSidePolyfills: false }),
                    ]).process(sassTransformed.css, {
                        to: path.basename(cssFile),
                        from: path.basename(scssFile),
                        map: { prev: sourceMap, inline: false },
                    });
                    let css = postcssTransformed.css;
                    if (postcssTransformed.map) {
                        const finalSourceMap = postcssTransformed.map.toJSON();
                        finalSourceMap.sourceRoot = '';
                        fs.writeFileSync(sourceMapFile, JSON.stringify(finalSourceMap));
                        css += `\n/*# sourceMappingURL=${path.basename(sourceMapFile)} */`;
                    }
                    fs.writeFileSync(cssFile, css);
                }
            }
            catch (sassErr) {
                logger_1.default.error(`Style compilation errors for ${scssFile}`);
                throw sassErr;
            }
        });
        if (onFinish) {
            stylesStream.on('finish', onFinish);
        }
    });
}
const svgoPreset = {
    name: 'preset-default',
    params: { overrides: { removeViewBox: false } },
};
function buildLibrary(config) {
    const internalGlobs = config.lib?.internalDirs?.map((dir) => `!${dir}/**/*`) ?? [];
    rimraf_1.rimraf.sync(paths_1.default.libBuild);
    // sources compilation
    const sourceStream = (0, fast_glob_1.globStream)(['**/*.{js,jsx,ts,tsx}', '!**/*.d.ts', ...internalGlobs], {
        cwd: paths_1.default.src,
    });
    sourceStream.on('data', (file) => {
        const sourceFile = getFilePath(file);
        const compiledFile = getFilePath(file, { dir: paths_1.default.libBuildEsm, ext: 'js' });
        const compiledDir = path.dirname(compiledFile);
        const sourcemapFile = getFilePath(file, { dir: paths_1.default.libBuildEsm, ext: 'js.map' });
        const sourcemapUrl = `// #sourceMappingURL=${path.basename(sourcemapFile)}`;
        const source = fs.readFileSync(sourceFile, 'utf-8');
        fs.mkdirSync(compiledDir, { recursive: true });
        babel.transform(source, {
            babelrc: false,
            configFile: false,
            filename: sourceFile,
            presets: [(0, babel_1.babelPreset)(config.lib)],
            plugins: [
                [
                    require.resolve('babel-plugin-inline-react-svg'),
                    {
                        ignorePattern: /^\./,
                        svgo: {
                            plugins: [svgoPreset],
                        },
                    },
                ],
                [
                    require.resolve('babel-plugin-import'),
                    {
                        libraryName: 'lodash',
                        libraryDirectory: '',
                        camel2DashComponentName: false,
                    },
                ],
                require.resolve('./babel-plugin-replace-paths'),
            ],
            sourceMaps: true,
        }, (err, transformed) => {
            if (err) {
                logger_1.default.error(`Source compilation errors for ${sourceFile}`);
                logger_1.default.error(err.toString());
                throw err;
            }
            else if (transformed) {
                const code = transformed.code ?? '';
                const esmCode = code + (code.length ? '\n' : '') + sourcemapUrl;
                fs.writeFile(compiledFile, esmCode, errorHandlerFactory(`Source compilation has failed on writing ${compiledFile}`));
                if (transformed.map) {
                    fs.writeFile(sourcemapFile, JSON.stringify(transformed.map), errorHandlerFactory(`Source compilation has failed on writing ${sourcemapFile}`));
                }
                compileToCjs(code, file, transformed.map);
            }
        });
    });
    // type definitions compilation and type checking
    const projectFilePath = path.resolve(paths_1.default.app, 'tsconfig.publish.json');
    const tscExec = path.resolve(paths_1.default.appNodeModules, 'typescript/bin/tsc');
    // eslint-disable-next-line security/detect-child-process
    childProcess.exec(`${tscExec} -p ${projectFilePath} --declaration --emitDeclarationOnly --outDir build/esm`, (error, stdout, stderr) => {
        logger_1.default.message(stdout);
        logger_1.default.error(stderr);
        if (!error && !stderr) {
            logger_1.default.message('Typechecking successfully completed');
            const typingsStream = (0, fast_glob_1.globStream)(['**/*.d.ts', '!cjs/**/*'], {
                cwd: paths_1.default.libBuildEsm,
            });
            typingsStream.on('data', copyToCjs);
        }
        else {
            logger_1.default.error('Errors during library typechecking. Aborting...');
            process.exit(1);
        }
    });
    // css compilation
    compileStyles(paths_1.default.libGlobalStyles, paths_1.default.libCompiledGlobalStyles, () => {
        compileStyles(paths_1.default.src, paths_1.default.libBuildEsm, () => {
            const stylesStream = (0, fast_glob_1.globStream)(['**/*.{css,css.map}'], {
                cwd: paths_1.default.libBuildEsm,
            });
            stylesStream.on('data', copyToCjs);
        }, internalGlobs);
    });
    // icons compilation to js
    const iconSvgoDefinition = `
    import React from 'react';
    const SvgComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export default SvgComponent;
    `;
    const iconBaseDefinition = `
    const icon: string;
    export default icon;
    `;
    const svgoRegEx = /assets\/icons/;
    const iconsStream = (0, fast_glob_1.globStream)(['**/*.svg', ...internalGlobs], { cwd: paths_1.default.libAssets });
    iconsStream.on('data', async (file) => {
        const iconFile = getFilePath(file, { dir: paths_1.default.libAssets });
        const componentFile = getFilePath(file, { dir: paths_1.default.libCompiledAssetsEsm, ext: 'js' });
        const componentDir = path.dirname(componentFile);
        const componentDefFile = getFilePath(file, { dir: paths_1.default.libCompiledAssetsEsm, ext: 'd.ts' });
        if (svgoRegEx.test(iconFile)) {
            try {
                const component = await (0, core_1.transform)(fs.readFileSync(iconFile, 'utf-8'), {
                    jsxRuntime: config.lib.newJsxTransform ? 'automatic' : 'classic',
                    plugins: [require.resolve('@svgr/plugin-jsx')],
                });
                babel.transform(component, {
                    babelrc: false,
                    configFile: false,
                    filename: iconFile,
                    presets: [(0, babel_1.babelPreset)(config.lib)],
                    sourceMaps: true,
                }, (err, transformed) => {
                    if (err) {
                        logger_1.default.error(`Icons compilation errors for ${iconFile}`);
                        logger_1.default.error(err.toString());
                        throw err;
                    }
                    else if (transformed) {
                        if (transformed.code) {
                            fs.mkdirSync(componentDir, { recursive: true });
                            fs.writeFile(componentFile, transformed.code, errorHandlerFactory(`Icons compilation has failed on writing ${componentFile}`));
                            fs.writeFile(componentDefFile, iconBaseDefinition, errorHandlerFactory(`Icons compilations has failed on writing ${componentFile}`));
                            compileToCjs(transformed.code, file, transformed.map, paths_1.default.libAssets, paths_1.default.libCompiledAssetsCjs);
                        }
                    }
                });
            }
            catch (err) {
                logger_1.default.error(`Svgo compilation errors for ${iconFile}`);
                throw err;
            }
        }
        else {
            const encoded = Buffer.from(fs.readFileSync(iconFile, 'utf-8')).toString('base64');
            const code = `export default 'data:image/svg+xml;base64,${encoded}'`;
            fs.mkdirSync(componentDir, { recursive: true });
            fs.writeFile(componentFile, code, errorHandlerFactory(`Icons compilation has failed on writing ${componentFile}`));
            fs.writeFile(componentDefFile, iconSvgoDefinition, errorHandlerFactory(`Icons compilations has failed on writing ${componentFile}`));
            compileToCjs(code, file, undefined, paths_1.default.libAssets, paths_1.default.libCompiledAssetsCjs);
        }
    });
    // file assets copying
    const assetsStream = (0, fast_glob_1.globStream)(['**/*.json', '!**/tsconfig.json', '**/*.d.ts', ...internalGlobs], { cwd: paths_1.default.src });
    assetsStream.on('data', (file) => {
        const assetFile = getFilePath(file);
        const copiedAssetFile = getFilePath(file, { dir: paths_1.default.libBuildEsm });
        const assetDir = path.dirname(copiedAssetFile);
        fs.mkdirSync(assetDir, { recursive: true });
        fs.copyFile(assetFile, copiedAssetFile, errorHandlerFactory(`Failed to copy file ${assetFile}`));
        copyToCjs(file, paths_1.default.src);
    });
}
