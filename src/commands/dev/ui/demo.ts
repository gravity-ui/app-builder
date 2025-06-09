#!/usr/bin/env node

import {TerminalTabs} from './TerminalTabs';

const tabs = new TerminalTabs();

// Инициализируем интерфейс табов
tabs.initialize();

// Симулируем логи от сервера и клиента
let logCounter = 0;

const addServerLog = () => {
    tabs.addLog({
        type: 'server',
        message: `Server log message ${++logCounter}`,
        timestamp: Date.now(),
        level: Math.random() > 0.7 ? 'success' : 'message',
    });
};

const addClientLog = () => {
    tabs.addLog({
        type: 'client',
        message: `Client build progress ${++logCounter}`,
        timestamp: Date.now(),
        level: Math.random() > 0.8 ? 'warning' : 'message',
    });
};

const addErrorLog = () => {
    const type = Math.random() > 0.5 ? 'server' : 'client';
    tabs.addLog({
        type,
        message: `Error in ${type}: Something went wrong ${++logCounter}`,
        timestamp: Date.now(),
        level: 'error',
    });
};

// Добавляем начальные логи
tabs.addLog({
    type: 'all',
    message: 'Демонстрация системы табов запущена',
    timestamp: Date.now(),
    level: 'success',
});

// Симулируем активность
setInterval(() => {
    const rand = Math.random();
    if (rand > 0.7) {
        addServerLog();
    } else if (rand > 0.4) {
        addClientLog();
    } else if (rand > 0.9) {
        addErrorLog();
    }
}, 500);

// Обработка выхода
process.on('SIGINT', () => {
    tabs.destroy();
    console.log('\nДемонстрация завершена');
    process.exit(0);
});

console.log(
    'Нажмите Ctrl+C для выхода, стрелки влево/вправо для переключения табов, c для очистки',
);
