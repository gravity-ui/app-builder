import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';
import _ from 'lodash';

import logger from '../logger';
import {readNodeModules, readPackage} from '../package';
import paths from '../paths';
import type {LinkedPackage} from '../models';
import tempData from '../tempData';
import {unlinkPackage} from './unlink';

function createRecursive(modulePath: string) {
    const {dir} = path.parse(modulePath);

    if (!fs.existsSync(dir)) {
        fs.mkdirpSync(dir);
    }
}

let unlinkTried = false;

export default function link(packageLocation: string) {
    const linkedPackageLocation = packageLocation.startsWith('/')
        ? packageLocation
        : path.resolve(paths.app, packageLocation);

    if (linkedPackageLocation) {
        const packageInfo = readPackage(linkedPackageLocation);
        const packNodeModulesDir = path.resolve(packageInfo.location, 'node_modules');
        const hiddenNodeModuleDir = path.resolve(packageInfo.location, '.node_modules');
        const linkedPackage: LinkedPackage = {
            name: packageInfo.name,
            location: packageInfo.location,
            nodeModules: [],
        };

        try {
            fs.moveSync(packNodeModulesDir, hiddenNodeModuleDir);

            const packNodeModulesInfo = readNodeModules(hiddenNodeModuleDir);
            const appNodeModulesInfo = readNodeModules(paths.appNodeModules);

            if (packageInfo.peerDependencies) {
                Object.keys(packageInfo.peerDependencies).forEach((peerDep) => {
                    if (!appNodeModulesInfo.keys.includes(peerDep)) {
                        logger.warning(
                            `Application doesn't have ${peerDep}, required in peerDependencies of linked package`,
                        );
                    } else {
                        const appDepVersion = appNodeModulesInfo.data[peerDep]!.version;
                        const requiredVersion = packageInfo.peerDependencies[peerDep]!;

                        if (!semver.satisfies(appDepVersion, requiredVersion)) {
                            logger.warning(
                                `Application dep ${peerDep} version ${appDepVersion} doesn't satisfy linked package requirement of ${requiredVersion}`,
                            );
                        }
                    }
                });
            }

            const nodeModulesToLink = packageInfo.devDependencies
                ? _.difference(packNodeModulesInfo.keys, Object.keys(packageInfo.devDependencies))
                : packNodeModulesInfo.keys;

            nodeModulesToLink.forEach((key) => {
                const nodeModule = packNodeModulesInfo.data[key]!;
                if (appNodeModulesInfo.keys.includes(key)) {
                    if (
                        !semver.satisfies(appNodeModulesInfo.data[key]!.version, nodeModule.version)
                    ) {
                        const newPath = path.resolve(packNodeModulesDir, nodeModule.name);
                        createRecursive(newPath);
                        fs.symlinkSync(nodeModule.location, newPath);
                        linkedPackage.nodeModules.push(newPath);
                    }
                } else {
                    const newPath = path.resolve(paths.appNodeModules, nodeModule.name);
                    createRecursive(newPath);
                    fs.symlinkSync(
                        nodeModule.location,
                        path.resolve(paths.appNodeModules, nodeModule.name),
                    );
                    linkedPackage.package = newPath;
                    linkedPackage.nodeModules.push(newPath);
                }
            });

            const newPath = path.resolve(paths.appNodeModules, packageInfo.name);
            if (fs.existsSync(newPath)) {
                const hiddenPackage = path.resolve(paths.appNodeModules, `.${packageInfo.name}`);
                fs.moveSync(newPath, hiddenPackage);
                linkedPackage.restorePackageFrom = hiddenPackage;
            }
            fs.symlinkSync(packageInfo.location, newPath);
            linkedPackage.package = newPath;

            if (fs.existsSync(path.resolve(linkedPackage.location, 'tsconfig.json'))) {
                linkedPackage.typescript = true;
            }

            let {linkedPackages} = tempData.getSettings();
            if (!linkedPackages) {
                linkedPackages = {data: {}, keys: []};
            }
            linkedPackages.data[linkedPackage.name] = linkedPackage;
            linkedPackages.keys.push(linkedPackage.name);
            tempData.saveSettings({linkedPackages});

            logger.success(`Link to ${linkedPackage.name} was successfully created`);
        } catch (e) {
            unlinkPackage(linkedPackage);

            if (!unlinkTried) {
                unlinkTried = true;
                link(packageLocation);
            } else {
                logger.logError(e as any);
            }
        }
    } else {
        logger.error('Package to link should be specified');
    }
}
