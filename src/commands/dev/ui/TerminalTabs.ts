import * as readline from 'readline';
import {EventEmitter} from 'events';

export interface LogEntry {
    type: 'server' | 'client' | 'all';
    message: string;
    timestamp: number;
    level: 'message' | 'success' | 'warning' | 'error' | 'verbose';
}

interface Tab {
    key: string;
    title: string;
    filter: (log: LogEntry) => boolean;
}

// ANSI escape codes для цветов
const ansi = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
};

const tabs: Tab[] = [
    {key: 'all', title: 'Все логи', filter: () => true},
    {key: 'server', title: 'Сервер', filter: (log: LogEntry) => log.type === 'server'},
    {key: 'client', title: 'Клиент', filter: (log: LogEntry) => log.type === 'client'},
];

export class TerminalTabs extends EventEmitter {
    private logs: LogEntry[] = [];
    private activeTab = 0;
    private maxLogs = 1000;
    private rl: readline.Interface;
    private isInitialized = false;

    constructor(maxLogs = 1000) {
        super();
        this.maxLogs = maxLogs;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        this.setupKeyHandlers();
    }

    initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.clear();
        this.render();
    }

    addLog(entry: LogEntry) {
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Обновляем только если таб инициализирован
        if (this.isInitialized) {
            this.render();
        }
    }

    destroy() {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        this.rl.close();
    }

    private setupKeyHandlers() {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.setEncoding('utf8');

            process.stdin.on('data', (key: string) => {
                // Ctrl+C
                if (key === '\u0003') {
                    process.exit();
                }

                switch (key) {
                    case '\u001b[D': // Стрелка влево
                    case 'h':
                        this.activeTab = this.activeTab > 0 ? this.activeTab - 1 : tabs.length - 1;
                        this.render();
                        break;
                    case '\u001b[C': // Стрелка вправо
                    case 'l':
                        this.activeTab = this.activeTab < tabs.length - 1 ? this.activeTab + 1 : 0;
                        this.render();
                        break;
                    case 'c':
                        this.clearLogs();
                        break;
                    case 'q':
                        process.exit();
                        break;
                }
            });
        }
    }

    private clearLogs() {
        this.logs = [];
        this.render();
    }

    private render() {
        if (!process.stdout.isTTY) return;

        // Очищаем экран
        console.clear();

        // Рендерим табы
        this.renderTabs();

        // Рендерим логи для активного таба
        this.renderLogs();

        // Рендерим справку
        this.renderHelp();
    }

    private renderTabs() {
        let tabsLine = '';
        tabs.forEach((tab, index) => {
            const isActive = index === this.activeTab;
            const title = ` ${tab.title} `;

            if (isActive) {
                tabsLine += `${ansi.cyan}${ansi.bold}${ansi.bgBlue}${title}${ansi.reset}`;
            } else {
                tabsLine += `${ansi.white}${title}${ansi.reset}`;
            }

            tabsLine += '  ';
        });

        console.log(tabsLine);
        console.log(`${ansi.dim}${'─'.repeat(process.stdout.columns || 80)}${ansi.reset}`);
    }

    private renderLogs() {
        const currentTab = tabs[this.activeTab];
        if (!currentTab) return;

        const filteredLogs = this.logs.filter(currentTab.filter);
        const displayLogs = filteredLogs.slice(-40); // Показываем последние 40 логов

        displayLogs.forEach((log) => {
            console.log(this.formatLogMessage(log));
        });
    }

    private formatLogMessage(log: LogEntry): string {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const prefix = `${ansi.dim}[${timestamp}] ${ansi.reset}`;

        let colorCode = ansi.white;
        switch (log.level) {
            case 'success':
                colorCode = ansi.green;
                break;
            case 'warning':
                colorCode = ansi.yellow;
                break;
            case 'error':
                colorCode = ansi.red;
                break;
            case 'verbose':
                colorCode = ansi.dim;
                break;
        }

        return `${prefix}${colorCode}${log.message}${ansi.reset}`;
    }

    private renderHelp() {
        const filteredCount = this.logs.filter(tabs[this.activeTab]?.filter || (() => true)).length;
        const help = `${ansi.dim}\nУправление: ← → (или h/l) - переключение табов | c - очистить | q - выход | Показано: ${filteredCount} логов${ansi.reset}`;
        console.log(help);
    }
}
