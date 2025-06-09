import {EventEmitter} from 'events';
import {BaseLogger, Logger} from '../../../common/logger';
import type {LogEntry} from './TerminalTabs';

export class LogCollector extends EventEmitter {
    private logs: LogEntry[] = [];
    private maxLogs = 1000;

    constructor(maxLogs = 1000) {
        super();
        this.maxLogs = maxLogs;
    }

    addLog(entry: LogEntry) {
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        this.emit('log', entry);
    }

    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    clear() {
        this.logs = [];
        this.emit('clear');
    }

    createLogger(type: 'server' | 'client', namespace?: string, verbose = false): BaseLogger {
        const logger = new Logger(namespace, verbose);

        // Перехватываем методы логирования
        const originalMessage = logger.message.bind(logger);
        const originalSuccess = logger.success.bind(logger);
        const originalWarning = logger.warning.bind(logger);
        const originalError = logger.error.bind(logger);
        const originalVerbose = logger.verbose.bind(logger);

        logger.message = (...args: string[]) => {
            const message = args.join(' ');
            this.addLog({
                type,
                message,
                timestamp: Date.now(),
                level: 'message',
            });
            return originalMessage(...args);
        };

        logger.success = (...args: string[]) => {
            const message = args.join(' ');
            this.addLog({
                type,
                message,
                timestamp: Date.now(),
                level: 'success',
            });
            return originalSuccess(...args);
        };

        logger.warning = (...args: string[]) => {
            const message = args.join(' ');
            this.addLog({
                type,
                message,
                timestamp: Date.now(),
                level: 'warning',
            });
            return originalWarning(...args);
        };

        logger.error = (...args: string[]) => {
            const message = args.join(' ');
            this.addLog({
                type,
                message,
                timestamp: Date.now(),
                level: 'error',
            });
            return originalError(...args);
        };

        logger.verbose = (...args: string[]) => {
            const message = args.join(' ');
            this.addLog({
                type,
                message,
                timestamp: Date.now(),
                level: 'verbose',
            });
            return originalVerbose(...args);
        };

        return logger;
    }
}

export const globalLogCollector = new LogCollector();
