/* eslint-env browser */
/* global __resourceQuery */

'use strict';

if (typeof EventSource !== 'function') {
    throw new Error("Environment doesn't support lazy compilation (requires EventSource)");
}

const urlBase = new URL(decodeURIComponent(__resourceQuery.slice(1))).pathname;
let activeEventSource;
const activeKeys = new Map();
const errorHandlers = new Set();

const updateEventSource = function updateEventSource() {
    if (activeEventSource) activeEventSource.close();
    if (activeKeys.size) {
        activeEventSource = new EventSource(
            '/build/lazy' + urlBase + Array.from(activeKeys.keys()).join('@'),
        );
        activeEventSource.onerror = function (event) {
            errorHandlers.forEach(function (onError) {
                onError(
                    new Error(
                        'Problem communicating active modules to the server: ' +
                            event.message +
                            ' ' +
                            event.filename +
                            ':' +
                            event.lineno +
                            ':' +
                            event.colno +
                            ' ' +
                            event.error,
                    ),
                );
            });
        };
    } else {
        activeEventSource = undefined;
    }
};

exports.keepAlive = function (options) {
    const data = options.data;
    const onError = options.onError;
    const active = options.active;
    const module = options.module;
    errorHandlers.add(onError);
    const value = activeKeys.get(data) || 0;
    activeKeys.set(data, value + 1);
    if (value === 0) {
        updateEventSource();
    }
    if (!active && !module.hot) {
        // eslint-disable-next-line no-console
        console.log('Hot Module Replacement is not enabled. Waiting for process restart...');
    }

    return function () {
        errorHandlers.delete(onError);
        setTimeout(function () {
            const valueToReduce = activeKeys.get(data);
            if (valueToReduce === 1) {
                activeKeys.delete(data);
                updateEventSource();
            } else {
                activeKeys.set(data, valueToReduce - 1);
            }
        }, 1000);
    };
};
