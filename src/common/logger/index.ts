import {colors} from './colors';
import {elapsedTime} from './pretty-time';
import stripAnsi from 'strip-ansi';

const allColors = [
    colors.cyan.bold,
    colors.blue.bold,
    colors.yellow.bold,
    colors.magenta.bold,
    colors.green.bold,
    colors.grey.bold,
];
function selectColor(namespace: string) {
    let hash = 0;

    for (let i = 0; i < namespace.length; i++) {
        /* eslint-disable no-bitwise */
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
        /* eslint-enable no-bitwise */
    }

    return allColors[Math.abs(hash) % allColors.length] ?? colors.green.bold;
}

export interface BaseLogger {
    message: (msg: string) => void;
    warning: (msg: string) => void;
    verbose: (msg: string) => void;
    success: (msg: string) => void;
    error: (msg: string) => void;
}

export class Logger implements BaseLogger {
    colors = colors;
    private _verbose = false;
    private _namespace = '';
    private _timestamp = BigInt(0);
    private _color = colors.black;

    constructor(namespace = '', verbose = false) {
        this._verbose = verbose;
        if (namespace) {
            this.setNamespace(namespace);
        }
    }

    print = (message: string, {verbose = false, wrap = false} = {}) => {
        if (verbose && !this._verbose) {
            return;
        }

        const prefix = this._namespace ? this._color(`[${this._namespace}]`) + ' ' : '';
        const postfix =
            this._timestamp > 0 ? ' ' + this._color(`+${elapsedTime(this._timestamp)}`) : '';

        let output = prefix + message + postfix;
        if (wrap) {
            const width = process.stdout.columns || (process.stdout.isTTY ? 80 : 200);
            if (stripAnsi(output).length > width) {
                output =
                    prefix + message.slice(0, width - stripAnsi(prefix + postfix).length) + postfix;
            }
        }

        process.stdout.write(output);
    };

    printLn = (message: string, {verbose = false} = {}) => {
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

    status = (msg: string) => {
        if (process.stdout.isTTY) {
            this.clearLine();
            this.print(msg, {wrap: true});
        }
    };

    message = (...args: string[]) => {
        this.printLn(args.join(' '));
    };

    success = (...args: string[]) => {
        this.printLn(this.colors.green(...args));
    };

    warning = (...args: string[]) => {
        this.printLn(this.colors.yellow(...args));
    };

    error = (...args: string[]) => {
        this.printLn(this.colors.red(...args));
    };

    logError = (errorMeta: string, error?: unknown) => {
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

    panic = (errorMeta: string, error?: unknown) => {
        this.logError(errorMeta, error);
        process.exit(1);
    };

    setVerbose = (verbose: boolean) => {
        this._verbose = verbose;
    };

    get isVerbose() {
        return this._verbose;
    }

    verbose = (...args: string[]) => {
        this.printLn(this.colors.dim(...args), {verbose: true});
    };

    setNamespace = (namespace: string) => {
        this._namespace = namespace;
        this._color = selectColor(namespace);
    };
}

export default new Logger();
