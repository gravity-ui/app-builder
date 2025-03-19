"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCli = createCli;
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const path = __importStar(require("node:path"));
const logger_1 = __importDefault(require("./common/logger"));
const config_1 = require("./common/config");
const models_1 = require("./common/models");
function createCli(argv) {
    const cli = (0, yargs_1.default)().parserConfiguration({
        'boolean-negation': false,
    });
    cli.scriptName('app-builder')
        .usage('Usage: $0 <command> [options]')
        .env('APP_BUILDER')
        .alias('h', 'help')
        .alias('v', 'version');
    try {
        cli.version('version', 'Show the version of the app-builder CLI package in the current project', getVersionInfo());
    }
    catch (e) {
        // ignore
    }
    return cli
        .option('verbose', {
        type: 'boolean',
        describe: 'Turn on verbose output',
        global: true,
    })
        .option('c', {
        alias: 'config',
        describe: 'Configuration file to use',
    })
        .option('env', {
        describe: 'Environment passed to the configuration when it is a function. Ex. --env foo.bar=1 --env foo.baz=2 ',
        type: 'array',
        string: true,
        coerce: (args) => {
            if (!args) {
                return {};
            }
            // [foo.bar=1, foo.baz, bar=2, baz=] => {foo: {bar: 1, baz: true}, bar: 2, baz: undefined}
            return args.reduce((values, value) => {
                // This ensures we're only splitting by the first `=`
                const [allKeys, val] = value.split(/[=](.+)/, 2);
                if (typeof allKeys === 'string') {
                    const splitKeys = allKeys.split(/\.(?!$)/);
                    let prevRef = values;
                    splitKeys.forEach((someKey, index) => {
                        if (index === splitKeys.length - 1) {
                            if (typeof val === 'string') {
                                prevRef[someKey] = val;
                            }
                            else if (someKey.endsWith('=')) {
                                prevRef[someKey.slice(0, -1)] = undefined;
                            }
                            else {
                                prevRef[someKey] = true;
                            }
                        }
                        else {
                            let nextRef = prevRef[someKey];
                            if (!nextRef || typeof nextRef !== 'object') {
                                nextRef = prevRef[someKey] = {};
                            }
                            prevRef = nextRef;
                        }
                    });
                }
                return values;
            }, {});
        },
    })
        .command({
        command: 'dev',
        describe: 'Start development server. Watches files, rebuilds, and hot reloads if something changes',
        builder: (_) => _.option('target', {
            describe: 'Select compilation unit',
            choices: ['client', 'server'],
        })
            .option('inspect', {
            group: 'Server',
            type: 'number',
            describe: 'Opens a port for debugging',
            coerce: (arg) => (arg === undefined ? true : arg),
        })
            .option('inspect-brk', {
            group: 'Server',
            type: 'number',
            describe: 'Opens a port for debugging. Will block until debugger is attached',
            coerce: (arg) => (arg === undefined ? true : arg),
        })
            .option('entry-filter', {
            group: 'Client',
            type: 'string',
            describe: 'Filters entries from src/ui/entries/* included in webpack bundle',
            array: true,
        })
            .option('disable-fork-ts-checker', {
            group: 'Client',
            describe: 'Disable typescript checks',
            type: 'boolean',
        })
            .option('disable-react-refresh', {
            group: 'Client',
            describe: 'Disable react-refresh',
            type: 'boolean',
        })
            .option('lazy-compilation', {
            group: 'Client',
            type: 'boolean',
            describe: 'Enable lazy compilation',
        })
            .option('debug-webpack', {
            group: 'Client',
            type: 'boolean',
            describe: 'Display final webpack configurations for debugging purposes',
        }),
        handler: handlerP(getCommandHandler('dev', (args, cmd) => {
            if ((0, models_1.isLibraryConfig)(args)) {
                throw new Error('dev command can be used only for services, but got the library config');
            }
            process.env.NODE_ENV = process.env.NODE_ENV || 'development';
            cmd(args);
            // Return an empty promise to prevent handlerP from exiting early.
            // The development server shouldn't ever exit until the user directly
            // kills it so this is fine.
            return new Promise(() => { });
        })),
    })
        .command({
        command: 'build',
        describe: 'Make production build',
        builder: (_) => _.option('target', {
            describe: 'Select compilation unit',
            choices: ['client', 'server'],
        })
            .option('entry-filter', {
            group: 'Client',
            type: 'string',
            describe: 'Filters entries from src/ui/entries/* included in webpack bundle',
            array: true,
        })
            .option('react-profiling', {
            group: 'Client',
            describe: 'Enable react profiling',
            type: 'boolean',
        })
            .option('analyze-bundle', {
            group: 'Client',
            describe: 'Analyze bundle',
            choices: ['true', 'statoscope', 'rsdoctor'],
        })
            .option('disable-fork-ts-checker', {
            group: 'Client',
            describe: 'Disable typescript checks',
            type: 'boolean',
        })
            .option('disable-source-map-generation', {
            group: 'Client',
            describe: 'Disable source map generation',
            type: 'boolean',
        })
            .option('cdn', {
            group: 'Client',
            describe: 'Disable upload files to CDN [false]',
            type: 'string',
        })
            .option('debug-webpack', {
            group: 'Client',
            type: 'boolean',
            describe: 'Display final webpack configurations for debugging purposes',
        }),
        handler: handlerP(getCommandHandler('build')),
    })
        .wrap(cli.terminalWidth())
        .strict()
        .demandCommand(1, `Pass --help to see all available commands and options.`)
        .recommendCommands()
        .parse((0, helpers_1.hideBin)(argv));
}
function getVersionInfo() {
    const { version } = require('../package.json');
    return `app-builder CLI version: ${version}`;
}
function handlerP(fn) {
    return (args) => {
        Promise.resolve(fn(args)).then(() => process.exit(0), (err) => logger_1.default.panic(err));
    };
}
function getCommandHandler(command, handler) {
    return async (argv) => {
        const config = await (0, config_1.getProjectConfig)(command, argv);
        logger_1.default.setVerbose(Boolean(config.verbose));
        const args = { ...config, logger: logger_1.default };
        const localCmd = resolveLocalCommand(command);
        logger_1.default.verbose(`running command: ${command}`);
        return handler ? handler(args, localCmd) : localCmd(args);
    };
}
function resolveLocalCommand(command) {
    try {
        const cmdPath = path.resolve(__dirname, `commands/${command}`);
        if (!cmdPath)
            return logger_1.default.panic(`There was a problem loading the ${command} command.`);
        logger_1.default.verbose(`loading command from: ${cmdPath}`);
        // eslint-disable-next-line security/detect-non-literal-require
        let cmd = require(cmdPath);
        if (cmd.__esModule) {
            cmd = cmd.default;
        }
        if (typeof cmd === 'function') {
            return cmd;
        }
        return logger_1.default.panic(`Handler for command "${command}" is not a function.`);
    }
    catch (err) {
        return logger_1.default.panic(`There was a problem loading the "${command}" command.`, err);
    }
}
