"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const colors_1 = require("./colors");
const pretty_time_1 = require("./pretty-time");
const strip_ansi_1 = __importDefault(require("strip-ansi"));
const allColors = [
    colors_1.colors.cyan.bold,
    colors_1.colors.blue.bold,
    colors_1.colors.yellow.bold,
    colors_1.colors.magenta.bold,
    colors_1.colors.green.bold,
    colors_1.colors.grey.bold,
];
function selectColor(namespace) {
    let hash = 0;
    for (let i = 0; i < namespace.length; i++) {
        /* eslint-disable no-bitwise */
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
        /* eslint-enable no-bitwise */
    }
    return allColors[Math.abs(hash) % allColors.length] ?? colors_1.colors.green.bold;
}
class Logger {
    colors = colors_1.colors;
    _verbose = false;
    _namespace = '';
    _timestamp = BigInt(0);
    _color = colors_1.colors.black;
    constructor(namespace = '', verbose = false) {
        this._verbose = verbose;
        if (namespace) {
            this.setNamespace(namespace);
        }
    }
    print = (message, { verbose = false, wrap = false } = {}) => {
        if (verbose && !this._verbose) {
            return;
        }
        const prefix = this._namespace ? this._color(`[${this._namespace}]`) + ' ' : '';
        const postfix = this._timestamp > 0 ? ' ' + this._color(`+${(0, pretty_time_1.elapsedTime)(this._timestamp)}`) : '';
        let output = prefix + message + postfix;
        if (wrap) {
            const width = process.stdout.columns || (process.stdout.isTTY ? 80 : 200);
            if ((0, strip_ansi_1.default)(output).length > width) {
                output =
                    prefix + message.slice(0, width - (0, strip_ansi_1.default)(prefix + postfix).length) + postfix;
            }
        }
        process.stdout.write(output);
    };
    printLn = (message, { verbose = false } = {}) => {
        if (verbose && !this._verbose) {
            return;
        }
        this.clearLine();
        this.print(message);
        process.stdout.write('\n');
        this._timestamp = process.hrtime.bigint();
    };
    clearLine = () => {
        if (process.stdout.isTTY) {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
        }
    };
    status = (msg) => {
        if (process.stdout.isTTY) {
            this.clearLine();
            this.print(msg, { wrap: true });
        }
    };
    message = (...args) => {
        this.printLn(args.join(' '));
    };
    success = (...args) => {
        this.printLn(this.colors.green(...args));
    };
    warning = (...args) => {
        this.printLn(this.colors.yellow(...args));
    };
    error = (...args) => {
        this.printLn(this.colors.red(...args));
    };
    logError = (errorMeta, error) => {
        this.error(errorMeta);
        if (error && typeof error === 'object') {
            if ('name' in error && typeof error.name === 'string') {
                this.error(error.name);
            }
            if ('message' in error && typeof error.message === 'string') {
                this.error(error.message);
            }
            if ('stack' in error && typeof error.stack === 'string') {
                this.error(error.stack);
            }
        }
    };
    panic = (errorMeta, error) => {
        this.logError(errorMeta, error);
        process.exit(1);
    };
    setVerbose = (verbose) => {
        this._verbose = verbose;
    };
    get isVerbose() {
        return this._verbose;
    }
    verbose = (...args) => {
        this.printLn(this.colors.dim(...args), { verbose: true });
    };
    setNamespace = (namespace) => {
        this._namespace = namespace;
        this._color = selectColor(namespace);
    };
}
exports.Logger = Logger;
exports.default = new Logger();
