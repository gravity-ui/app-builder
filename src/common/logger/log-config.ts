/* eslint-disable no-console */
import {colors} from './colors.js';

export function logConfig(caption: string, config: unknown) {
    console.log(colors.cyan(caption));
    console.dir(config, {depth: Infinity});
}
