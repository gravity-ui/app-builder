export interface BaseLogger {
    message: (msg: string) => void;
    warning: (msg: string) => void;
    verbose: (msg: string) => void;
    success: (msg: string) => void;
    error: (msg: string) => void;
}
export declare class Logger implements BaseLogger {
    colors: import("chalk").Chalk & import("chalk").ChalkFunction & {
        supportsColor: import("chalk").ColorSupport | false;
        Level: import("chalk").Level;
        Color: ("black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray" | "grey" | "blackBright" | "redBright" | "greenBright" | "yellowBright" | "blueBright" | "magentaBright" | "cyanBright" | "whiteBright") | ("bgBlack" | "bgRed" | "bgGreen" | "bgYellow" | "bgBlue" | "bgMagenta" | "bgCyan" | "bgWhite" | "bgGray" | "bgGrey" | "bgBlackBright" | "bgRedBright" | "bgGreenBright" | "bgYellowBright" | "bgBlueBright" | "bgMagentaBright" | "bgCyanBright" | "bgWhiteBright");
        ForegroundColor: "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray" | "grey" | "blackBright" | "redBright" | "greenBright" | "yellowBright" | "blueBright" | "magentaBright" | "cyanBright" | "whiteBright";
        BackgroundColor: "bgBlack" | "bgRed" | "bgGreen" | "bgYellow" | "bgBlue" | "bgMagenta" | "bgCyan" | "bgWhite" | "bgGray" | "bgGrey" | "bgBlackBright" | "bgRedBright" | "bgGreenBright" | "bgYellowBright" | "bgBlueBright" | "bgMagentaBright" | "bgCyanBright" | "bgWhiteBright";
        Modifiers: "bold" | "reset" | "dim" | "italic" | "underline" | "inverse" | "hidden" | "strikethrough" | "visible";
        stderr: import("chalk").Chalk & {
            supportsColor: import("chalk").ColorSupport | false;
        };
    };
    private _verbose;
    private _namespace;
    private _timestamp;
    private _color;
    constructor(namespace?: string, verbose?: boolean);
    print: (message: string, { verbose, wrap }?: {
        verbose?: boolean | undefined;
        wrap?: boolean | undefined;
    }) => void;
    printLn: (message: string, { verbose }?: {
        verbose?: boolean | undefined;
    }) => void;
    clearLine: () => void;
    status: (msg: string) => void;
    message: (...args: string[]) => void;
    success: (...args: string[]) => void;
    warning: (...args: string[]) => void;
    error: (...args: string[]) => void;
    logError: (errorMeta: string, error?: unknown) => void;
    panic: (errorMeta: string, error?: unknown) => never;
    setVerbose: (verbose: boolean) => void;
    get isVerbose(): boolean;
    verbose: (...args: string[]) => void;
    setNamespace: (namespace: string) => void;
}
declare const _default: Logger;
export default _default;
