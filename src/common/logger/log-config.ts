import {colors} from './colors';

export function logConfig(caption: string, config: unknown) {
    console.log(colors.cyan(caption));
    console.dir(config, {depth: Infinity});
}
