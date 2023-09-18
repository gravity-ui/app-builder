import fs from 'fs-extra';
import {rimraf} from 'rimraf';
import * as path from 'node:path';

import type {LinkedPackage} from '../models';
import logger from '../logger';
import tempData from '../tempData';
// import paths from '../paths';

export function unlinkPackage(linkedPackage: LinkedPackage) {
    logger.warning('Cleaning up created links...');
    linkedPackage.nodeModules.forEach(fs.unlinkSync);

    if (linkedPackage.package) {
        fs.unlinkSync(linkedPackage.package);
    }

    if (linkedPackage.package && linkedPackage.restorePackageFrom) {
        fs.moveSync(linkedPackage.restorePackageFrom, linkedPackage.package);
    }

    const packNodeModulesDir = path.resolve(linkedPackage.location, 'node_modules');
    const hiddenNodeModuleDir = path.resolve(linkedPackage.location, '.node_modules');
    rimraf.sync(packNodeModulesDir);
    fs.moveSync(hiddenNodeModuleDir, packNodeModulesDir);

    const {linkedPackages} = tempData.getSettings();
    if (linkedPackages) {
        delete linkedPackages.data[linkedPackage.name];
        linkedPackages.keys.splice(linkedPackages.keys.indexOf(linkedPackage.name), 1);
        tempData.saveSettings({linkedPackages});
    }

    logger.success(`${linkedPackage.name} package was unlinked`);
}

export default function unlink() {
    const {linkedPackages} = tempData.getSettings();
    if (linkedPackages) {
        // const packageToUnlink = config.subcommands && config.subcommands[0];
        //
        // if (packageToUnlink) {
        //     let foundPackage: LinkedPackage | undefined;
        //     if (linkedPackages.data[packageToUnlink]) {
        //         foundPackage = linkedPackages.data[packageToUnlink];
        //     } else {
        //         const locationToFind = packageToUnlink.startsWith('/')
        //             ? packageToUnlink
        //             : path.resolve(paths.app, packageToUnlink);
        //
        //         foundPackage = linkedPackages.keys
        //             .map((key) => linkedPackages.data[key])
        //             .find(({location}) => location === locationToFind);
        //     }
        //
        //     if (foundPackage) {
        //         unlinkPackage(foundPackage);
        //     } else {
        //         logger.error(`Package '${packageToUnlink}' not found`);
        //     }
        // } else {
        const {length} = linkedPackages.keys;
        linkedPackages.keys.forEach((key) => unlinkPackage(linkedPackages.data[key]!));
        tempData.clearSetting('linkedPackages');

        if (length > 1) {
            logger.success('All packages were unlinked');
        }
        // }
    } else {
        logger.warning('Found no packages to unlink');
    }
}
