import * as path from 'node:path';
import * as fs from 'node:fs';

import type {Entities, LinkedPackage} from './models';
import paths from './paths';
import logger from './logger';

interface TempData {
    linkedPackages?: Entities<LinkedPackage>;
}

const tempDataPath = path.resolve(paths.appNodeModules, '.app-builder.temp.json');

class TempDataUtils {
    private state: Partial<TempData>;

    constructor() {
        try {
            const settingsJson = fs.readFileSync(tempDataPath, 'utf-8');
            this.state = JSON.parse(settingsJson) as Partial<TempData>;
        } catch (e) {
            this.state = {};
        }
    }

    saveSettings(newSettings: Partial<TempData> = {}) {
        this.state = {...this.state, ...newSettings};
        if (fs.existsSync(tempDataPath)) {
            fs.unlinkSync(tempDataPath);
        }

        try {
            fs.writeFileSync(tempDataPath, JSON.stringify(this.state), 'utf-8');
            return true;
        } catch (e) {
            logger.logError(e as any);
            return false;
        }
    }

    getSettings() {
        return this.state;
    }

    clearSetting(settingName: keyof TempData) {
        delete this.state[settingName];
        this.saveSettings();
    }
}

export default new TempDataUtils();
