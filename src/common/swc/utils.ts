import {convert} from 'tsconfig-to-swcconfig';

export function getSwcOptionsFromTsconfig(projectPath: string, filename = 'tsconfig.json') {
    return convert(filename, projectPath);
}
