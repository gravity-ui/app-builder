import * as path from 'node:path';
import * as fs from 'node:fs';
import * as childProcess from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import * as babel from '@babel/core';
import {globStream} from 'fast-glob';
import {rimraf} from 'rimraf';
import sass from 'sass';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';
import {transform} from '@svgr/core';

import paths from '../../common/paths';
import logger from '../../common/logger';
import {babelPreset} from '../babel';

import type {PluginConfig} from 'svgo';
import type {TransformOptions} from '@babel/core';
import type {LibraryConfig} from '../models';

interface GetFilePathOpts {
    ext?: string;
    dir?: string;
}

function getFilePath(filePath: string, {ext, dir}: GetFilePathOpts = {dir: paths.src}) {
    let filePathWithExt = filePath;
    if (ext) {
        filePathWithExt = filePath.replace(path.extname(filePath), `.${ext}`);
    }

    return dir ? path.resolve(dir, filePathWithExt) : filePathWithExt;
}

function errorHandlerFactory(msg?: string) {
    return (err: NodeJS.ErrnoException | null) => {
        if (err) {
            if (msg) {
                logger.error(msg);
            }

            logger.error(err.toString());
            throw err;
        }
    };
}

function copyToCjs(file: string, inputDir = paths.libBuildEsm) {
    const esmFile = getFilePath(file, {dir: inputDir});
    const cjsFile = getFilePath(file, {dir: paths.libBuildCjs});
    const cjsDir = path.dirname(cjsFile);

    fs.mkdirSync(cjsDir, {recursive: true});
    fs.copyFile(esmFile, cjsFile, errorHandlerFactory(`Failed to copy file to cjs ${esmFile}`));
}

function compileToCjs(
    code: string,
    file: string,
    inputSourceMap?: TransformOptions['inputSourceMap'],
    sourceDir = paths.src,
    compiledDir = paths.libBuildCjs,
) {
    const sourceFile = getFilePath(file, {dir: sourceDir});
    const compiledCjsFile = getFilePath(file, {dir: compiledDir, ext: 'js'});
    const compiledCjsDir = path.dirname(compiledCjsFile);
    const sourcemapCjsFile = getFilePath(file, {dir: compiledDir, ext: 'js.map'});
    const sourcemapCjsUrl = `// #sourceMappingURL=${path.basename(sourcemapCjsFile)}`;

    fs.mkdirSync(compiledCjsDir, {recursive: true});
    babel.transform(
        code,
        {
            babelrc: false,
            configFile: false,
            filename: sourceFile,
            plugins: [
                require.resolve('@babel/plugin-transform-modules-commonjs'),
                require.resolve('@babel/plugin-transform-dynamic-import'),
            ],
            sourceMaps: true,
            inputSourceMap,
        },
        (err, transformedCjs) => {
            if (err) {
                logger.error(`Source compilation errors for ${sourceFile}`);
                logger.error(err.toString());
                throw err;
            } else if (transformedCjs) {
                let cjsCode = transformedCjs.code ?? '';
                cjsCode += (cjsCode.length ? '\n' : '') + sourcemapCjsUrl;

                fs.writeFile(
                    compiledCjsFile,
                    cjsCode,
                    errorHandlerFactory(
                        `Source compilation has failed on writing ${compiledCjsFile}`,
                    ),
                );

                if (transformedCjs.map) {
                    fs.writeFile(
                        sourcemapCjsFile,
                        JSON.stringify(transformedCjs.map),
                        errorHandlerFactory(
                            `Source compilation has failed on writing ${sourcemapCjsFile}`,
                        ),
                    );
                }
            }
        },
    );
}

function compileStyles(
    inputDir: string,
    outputDir: string,
    onFinish?: () => void,
    additionalGlobs: string[] = [],
) {
    const origStylesStream = globStream(['**/*.{sass,scss,css}', ...additionalGlobs], {
        cwd: inputDir,
    });
    origStylesStream.on('data', (file) => {
        const origScssFile = getFilePath(file, {dir: inputDir});
        const scssFile = getFilePath(file, {dir: outputDir});
        const scssDir = path.dirname(scssFile);

        fs.mkdirSync(scssDir, {recursive: true});
        if (origScssFile !== scssFile) {
            const content = fs
                .readFileSync(origScssFile, 'utf-8')
                .replace(/url\(([.]*)..\/assets\//g, 'url($1../../assets/');
            fs.writeFileSync(scssFile, content);
        }
    });

    origStylesStream.on('finish', () => {
        const globs =
            outputDir === paths.libBuildEsm
                ? ['**/*.{sass,scss,css}', '!cjs/**/*']
                : ['**/*.{sass,scss,css}'];
        const stylesStream = globStream(globs, {cwd: outputDir});
        stylesStream.on('data', async (file) => {
            const origScssFile = getFilePath(file, {dir: inputDir});
            const scssFile = getFilePath(file, {dir: outputDir});
            const cssFile = getFilePath(file, {dir: outputDir, ext: 'css'});
            const sourceMapFile = getFilePath(file, {dir: outputDir, ext: 'css.map'});

            try {
                const sassTransformed = sass.compile(scssFile, {
                    sourceMap: true,
                    sourceMapIncludeSources: true,
                    importers: [
                        {
                            findFileUrl(url) {
                                if (url.startsWith('~')) {
                                    return pathToFileURL(
                                        getFilePath(url.substring(1), {dir: paths.appNodeModules}),
                                    );
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
                            return path.relative(path.dirname(scssFile), fileURLToPath(url));
                        });
                    }
                    const postcssTransformed = await postcss([
                        postcssPresetEnv({enableClientSidePolyfills: false}),
                    ]).process(sassTransformed.css, {
                        to: path.basename(cssFile),
                        from: path.basename(scssFile),
                        map: {prev: sourceMap, inline: false},
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
            } catch (sassErr) {
                logger.error(`Style compilation errors for ${scssFile}`);
                throw sassErr;
            }
        });

        if (onFinish) {
            stylesStream.on('finish', onFinish);
        }
    });
}

const svgoPreset: PluginConfig = {
    name: 'preset-default',
    params: {overrides: {removeViewBox: false}},
};
export function buildLibrary(config: LibraryConfig) {
    const internalGlobs = config.lib?.internalDirs?.map((dir) => `!${dir}/**/*`) ?? [];
    rimraf.sync(paths.libBuild);

    const tsConfigFilePath = path.resolve(paths.app, 'tsconfig.publish.json');

    // sources compilation
    const sourceStream = globStream(['**/*.{js,jsx,ts,tsx}', '!**/*.d.ts', ...internalGlobs], {
        cwd: paths.src,
    });
    sourceStream.on('data', (file) => {
        const sourceFile = getFilePath(file);
        const compiledFile = getFilePath(file, {dir: paths.libBuildEsm, ext: 'js'});
        const compiledDir = path.dirname(compiledFile);
        const sourcemapFile = getFilePath(file, {dir: paths.libBuildEsm, ext: 'js.map'});
        const sourcemapUrl = `// #sourceMappingURL=${path.basename(sourcemapFile)}`;

        const source = fs.readFileSync(sourceFile, 'utf-8');

        fs.mkdirSync(compiledDir, {recursive: true});
        babel.transform(
            source,
            {
                babelrc: false,
                configFile: false,
                filename: sourceFile,
                presets: [babelPreset(config.lib)],
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
                    [
                        require.resolve('babel-plugin-tsconfig-paths-module-resolver'),
                        {
                            tsconfig: tsConfigFilePath,
                        },
                    ],
                    require.resolve('./babel-plugin-replace-paths'),
                ],
                sourceMaps: true,
            },
            (err, transformed) => {
                if (err) {
                    logger.error(`Source compilation errors for ${sourceFile}`);
                    logger.error(err.toString());
                    throw err;
                } else if (transformed) {
                    const code = transformed.code ?? '';
                    const esmCode = code + (code.length ? '\n' : '') + sourcemapUrl;
                    fs.writeFile(
                        compiledFile,
                        esmCode,
                        errorHandlerFactory(
                            `Source compilation has failed on writing ${compiledFile}`,
                        ),
                    );

                    if (transformed.map) {
                        fs.writeFile(
                            sourcemapFile,
                            JSON.stringify(transformed.map),
                            errorHandlerFactory(
                                `Source compilation has failed on writing ${sourcemapFile}`,
                            ),
                        );
                    }

                    compileToCjs(code, file, transformed.map);
                }
            },
        );
    });

    // type definitions compilation and type checking
    const tscExec = path.resolve(paths.appNodeModules, 'typescript/bin/tsc');
    // eslint-disable-next-line security/detect-child-process
    childProcess.exec(
        `${tscExec} -p ${tsConfigFilePath} --declaration --emitDeclarationOnly --outDir build/esm`,
        (error, stdout, stderr) => {
            logger.message(stdout);
            logger.error(stderr);

            if (!error && !stderr) {
                logger.message('Typechecking successfully completed');
                const typingsStream = globStream(['**/*.d.ts', '!cjs/**/*'], {
                    cwd: paths.libBuildEsm,
                });
                typingsStream.on('data', copyToCjs);
            } else {
                logger.error('Errors during library typechecking. Aborting...');
                process.exit(1);
            }
        },
    );

    // css compilation
    compileStyles(paths.libGlobalStyles, paths.libCompiledGlobalStyles, () => {
        compileStyles(
            paths.src,
            paths.libBuildEsm,
            () => {
                const stylesStream = globStream(['**/*.{css,css.map}'], {
                    cwd: paths.libBuildEsm,
                });
                stylesStream.on('data', copyToCjs);
            },
            internalGlobs,
        );
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

    const iconsStream = globStream(['**/*.svg', ...internalGlobs], {cwd: paths.libAssets});
    iconsStream.on('data', async (file) => {
        const iconFile = getFilePath(file, {dir: paths.libAssets});
        const componentFile = getFilePath(file, {dir: paths.libCompiledAssetsEsm, ext: 'js'});
        const componentDir = path.dirname(componentFile);
        const componentDefFile = getFilePath(file, {dir: paths.libCompiledAssetsEsm, ext: 'd.ts'});

        if (svgoRegEx.test(iconFile)) {
            try {
                const component = await transform(fs.readFileSync(iconFile, 'utf-8'), {
                    jsxRuntime: config.lib.newJsxTransform ? 'automatic' : 'classic',
                    plugins: [require.resolve('@svgr/plugin-jsx')],
                });

                babel.transform(
                    component,
                    {
                        babelrc: false,
                        configFile: false,
                        filename: iconFile,
                        presets: [babelPreset(config.lib)],
                        sourceMaps: true,
                    },
                    (err, transformed) => {
                        if (err) {
                            logger.error(`Icons compilation errors for ${iconFile}`);
                            logger.error(err.toString());
                            throw err;
                        } else if (transformed) {
                            if (transformed.code) {
                                fs.mkdirSync(componentDir, {recursive: true});
                                fs.writeFile(
                                    componentFile,
                                    transformed.code,
                                    errorHandlerFactory(
                                        `Icons compilation has failed on writing ${componentFile}`,
                                    ),
                                );
                                fs.writeFile(
                                    componentDefFile,
                                    iconBaseDefinition,
                                    errorHandlerFactory(
                                        `Icons compilations has failed on writing ${componentFile}`,
                                    ),
                                );
                                compileToCjs(
                                    transformed.code,
                                    file,
                                    transformed.map,
                                    paths.libAssets,
                                    paths.libCompiledAssetsCjs,
                                );
                            }
                        }
                    },
                );
            } catch (err) {
                logger.error(`Svgo compilation errors for ${iconFile}`);
                throw err;
            }
        } else {
            const encoded = Buffer.from(fs.readFileSync(iconFile, 'utf-8')).toString('base64');
            const code = `export default 'data:image/svg+xml;base64,${encoded}'`;
            fs.mkdirSync(componentDir, {recursive: true});
            fs.writeFile(
                componentFile,
                code,
                errorHandlerFactory(`Icons compilation has failed on writing ${componentFile}`),
            );
            fs.writeFile(
                componentDefFile,
                iconSvgoDefinition,
                errorHandlerFactory(`Icons compilations has failed on writing ${componentFile}`),
            );
            compileToCjs(code, file, undefined, paths.libAssets, paths.libCompiledAssetsCjs);
        }
    });

    // file assets copying
    const assetsStream = globStream(
        ['**/*.json', '!**/tsconfig.json', '**/*.d.ts', ...internalGlobs],
        {cwd: paths.src},
    );
    assetsStream.on('data', (file) => {
        const assetFile = getFilePath(file);
        const copiedAssetFile = getFilePath(file, {dir: paths.libBuildEsm});
        const assetDir = path.dirname(copiedAssetFile);

        fs.mkdirSync(assetDir, {recursive: true});
        fs.copyFile(
            assetFile,
            copiedAssetFile,
            errorHandlerFactory(`Failed to copy file ${assetFile}`),
        );
        copyToCjs(file, paths.src);
    });
}
