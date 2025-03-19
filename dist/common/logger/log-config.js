"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logConfig = logConfig;
/* eslint-disable no-console */
const colors_1 = require("./colors");
function logConfig(caption, config) {
    console.log(colors_1.colors.cyan(caption));
    console.dir(config, { depth: Infinity });
}
