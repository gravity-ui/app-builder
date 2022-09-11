import fs from 'fs';
import path from 'path';

import type {Entities, ProjectConfig} from './models';

interface PackageInfo {
    name: string;
    version: string;
    peerDependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    location: string;
    'app-builder'?: ProjectConfig;
}

export function readPackage(location: string) {
    const packageJsonLocation = path.resolve(location, 'package.json');

    if (!fs.existsSync(packageJsonLocation)) {
        throw new Error(`package.json not found in ${location}`);
    }

    try {
        const packageJson = fs.readFileSync(packageJsonLocation, 'utf-8');
        return {
            ...(JSON.parse(packageJson) as PackageInfo),
            location,
        };
    } catch (e) {
        throw new Error(`Couldn't read package.json at ${location}`);
    }
}

export function readNodeModules(location: string) {
    const dirContents = fs.readdirSync(location);
    return dirContents.reduce(
        (acc, nodeModule) => {
            if (!nodeModule.startsWith('.')) {
                const nodeModulePath = path.resolve(location, nodeModule);
                if (fs.existsSync(path.resolve(nodeModulePath, 'package.json'))) {
                    const packageInfo = readPackage(nodeModulePath);
                    acc.data[packageInfo.name] = packageInfo;
                    acc.keys.push(packageInfo.name);
                } else {
                    const {data, keys} = readNodeModules(nodeModulePath);
                    acc.data = {...acc.data, ...data};
                    acc.keys = [...acc.keys, ...keys];
                }
            }
            return acc;
        },
        {data: {}, keys: []} as Entities<PackageInfo>,
    );
}
