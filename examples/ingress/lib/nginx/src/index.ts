/**
 * nginx dev ingress — entrypoint.
 *
 * `newNginxIngressListeningHandler(options)` returns `{handle, stop}`:
 *   - `handle(devServer)` is meant to be assigned to `client.devServer.onListening`. When the dev
 *     server socket/port goes live it renders the nginx config (`nginx` module) and ships it to the
 *     remote host, holding the reverse tunnels open (`sync` module).
 *   - `stop()` tears the tunnels down; wire it to your process signals.
 */

import {readFileSync} from 'node:fs';
import path from 'node:path';

import {DEFAULT_RELOAD_COMMAND, render} from './nginx.js';
import {sync} from './sync.js';
import type {SyncHandle} from './sync.js';

/** Minimal structural shape of the webpack/rspack dev-server instance passed to `onListening`. */
export interface DevServerLike {
    server?: {
        address(): string | {port: number; address?: string} | null;
    } | null;
}

export interface IngressOptions {
    /** Path to the nginx template, resolved from the project cwd. */
    template: string;
    /** nginx server_name(s); the first also names the default remote config file. */
    serverName: string | string[];
    remote: {
        /** ssh target that runs nginx, e.g. `me@dev-vm`. */
        host: string;
        /**
         * `/build/` upstream. The remote nginx proxies to `127.0.0.1:<reversePort>`, which
         * `ssh -R` forwards to the client dev server (its local address is read from `onListening`).
         */
        client: {reversePort: number};
        /**
         * Everything-else upstream (the node server). nginx proxies to `127.0.0.1:<reversePort>`,
         * forwarded to the node's local endpoint — a `socket` path (resolved from cwd) or a
         * `localPort` — since `onListening` does not expose the node.
         */
        server: {reversePort: number; socket?: string; localPort?: number};
        /** Absolute path on the VM to write the config to. Default: `sites-enabled/<serverName>.conf`. */
        configPath?: string;
        /** Command to reload nginx over ssh. Default: `sudo nginx -s reload`. */
        reloadCommand?: string;
        /** Extra arguments for the ssh tunnel process. */
        extraSshArgs?: string[];
    };
    /** Extra template params. Built-ins (`APP_SERVER_NAME`, `APP_*_UPSTREAM`) always win. */
    params?: Record<string, string>;
}

export interface NginxIngressListeningHandler {
    /** Assign to `client.devServer.onListening`. Runs the ingress setup once, on first listen. */
    handle: (server: DevServerLike) => void;
    /** Tear the reverse tunnels down. Wire to SIGINT/SIGTERM. */
    stop: () => Promise<void>;
}

/** ipc socket path (string) or `localhost:<port>` from a dev server's `address()`. */
function addressToLocalTarget(address: string | {port: number} | null | undefined): string {
    if (!address) {
        throw new Error('nginx ingress: dev server is not listening yet (no address)');
    }
    return typeof address === 'string' ? address : `localhost:${address.port}`;
}

async function setupIngress(server: DevServerLike, options: IngressOptions): Promise<SyncHandle> {
    const {remote} = options;
    const serverNames = Array.isArray(options.serverName)
        ? options.serverName
        : [options.serverName];

    // Client dev server: local address is discovered dynamically from the listening server.
    const clientLocal = addressToLocalTarget(server.server?.address());
    // Node server: not exposed by onListening, so its local endpoint comes from the config.
    const serverLocal = remote.server.socket
        ? path.resolve(process.cwd(), remote.server.socket)
        : `localhost:${remote.server.localPort}`;

    const template = readFileSync(path.resolve(process.cwd(), options.template), 'utf8');
    const conf = render(template, {
        ...options.params,
        APP_SERVER_NAME: serverNames.join(' '),
        APP_CLIENT_UPSTREAM: `127.0.0.1:${remote.client.reversePort}`,
        APP_SERVER_UPSTREAM: `127.0.0.1:${remote.server.reversePort}`,
    });

    return sync(conf, {
        host: remote.host,
        configPath: remote.configPath ?? `/etc/nginx/sites-enabled/${serverNames[0]}.conf`,
        reloadCommand: remote.reloadCommand ?? DEFAULT_RELOAD_COMMAND,
        tunnels: [
            {port: remote.client.reversePort, localTarget: clientLocal},
            {port: remote.server.reversePort, localTarget: serverLocal},
        ],
        extraSshArgs: remote.extraSshArgs,
    });
}

export function newNginxIngressListeningHandler(
    options: IngressOptions,
): NginxIngressListeningHandler {
    let syncHandle: SyncHandle | undefined;
    let started = false;
    let stopped = false;

    const handle = (server: DevServerLike) => {
        // onListening can fire again after a dev-server restart; only set up once.
        if (started) {
            return;
        }
        started = true;

        setupIngress(server, options)
            .then((h) => {
                // If stop() was already called while we were setting up, tear down immediately.
                if (stopped) {
                    h.stop().catch(() => {});
                } else {
                    syncHandle = h;
                }
            })
            .catch((error: unknown) => {
                console.error('[nginx-ingress] setup failed:', error);
            });
    };

    const stop = async () => {
        stopped = true;
        if (syncHandle) {
            const h = syncHandle;
            syncHandle = undefined;
            await h.stop();
        }
    };

    return {handle, stop};
}
