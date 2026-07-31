/**
 * Ships a rendered nginx config to a remote host over ssh and holds a reverse tunnel open, so the
 * remote nginx upstream reaches the local dev server. Generic transport — no nginx knowledge.
 *
 * Auth is left entirely to ssh: the ssh invocations below run with inherited stdio, so any host
 * key / 2FA / sudo prompt is answered in your terminal. Use an ssh agent or a `ControlMaster` entry
 * in ~/.ssh/config to avoid repeated prompts. The remote user must be able to write `configPath`
 * and run `reloadCommand` (e.g. passwordless sudo, or a user-writable include dir).
 */

import {execFileSync, spawn} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';

export interface SyncTarget {
    host: string;
    configPath: string;
    reloadCommand: string;
    /** Reverse forwards: each maps remote `127.0.0.1:<port>` → a local socket path or `host:port`. */
    tunnels: Array<{port: number; localTarget: string}>;
    extraSshArgs?: string[];
}

export interface SyncHandle {
    stop: () => Promise<void>;
}

/** POSIX single-quote a value for safe embedding in a remote shell command. */
function shellSingleQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sshRun(host: string, remoteScript: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn('ssh', [host, remoteScript], {stdio: 'inherit'});
        proc.on('error', reject);
        proc.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`ssh exited with code ${code}`)),
        );
    });
}

export async function sync(config: string, target: SyncTarget): Promise<SyncHandle> {
    const {host, configPath, reloadCommand, tunnels, extraSshArgs} = target;

    // 1. Push the rendered config + reload nginx, and wait for it (fail fast on a bad config).
    //    The config travels base64-encoded inside the command (not over stdin), so ssh's stdin/tty
    //    stays free for auth and sudo prompts.
    const encoded = Buffer.from(config, 'utf8').toString('base64');
    const pushScript =
        `printf %s ${shellSingleQuote(encoded)} | base64 -d | ` +
        `sudo tee ${shellSingleQuote(configPath)} > /dev/null && ${reloadCommand}`;
    await sshRun(host, pushScript);

    // 2. Open the reverse forwards on a single ssh connection (one `-R` per tunnel): each remote
    //    127.0.0.1:<port> -> a local dev server endpoint. This is the interactive step — the user
    //    completes ssh auth when it starts.
    const forwardArgs = tunnels.flatMap((t) => ['-R', `${t.port}:${t.localTarget}`]);
    const tunnelProc: ChildProcess = spawn(
        'ssh',
        [
            '-N',
            '-o',
            'ExitOnForwardFailure=yes',
            '-o',
            'ServerAliveInterval=30',
            '-o',
            'ServerAliveCountMax=3',
            ...(extraSshArgs ?? []),
            ...forwardArgs,
            host,
        ],
        {stdio: 'inherit'},
    );
    tunnelProc.on('exit', (code, signal) => {
        if (signal !== 'SIGTERM' && code) {
            console.error(`[nginx-ingress] reverse tunnel exited (code=${code})`);
        }
    });

    // Removing the config on shutdown must be an explicit step: a remote `trap` on the tunnel
    // cannot do it, because without a PTY ssh delivers no signal (and no stdin EOF) to the remote
    // command when the client disconnects — it would just orphan and never fire.
    const cleanupScript = `sudo rm -f ${shellSingleQuote(configPath)} && ${reloadCommand}`;
    let stopped = false;

    return {
        stop: async () => {
            if (stopped) {
                return;
            }
            stopped = true;

            // Remove the config on the VM and reload — SYNCHRONOUSLY, so it finishes before any
            // later signal handler (e.g. app-builder's SIGINT handler, which calls process.exit)
            // can end the process out from under an async cleanup.
            try {
                execFileSync('ssh', [host, cleanupScript], {stdio: 'inherit', timeout: 15_000});
            } catch (error) {
                console.error(
                    '[nginx-ingress] remote cleanup failed:',
                    error instanceof Error ? error.message : error,
                );
            }

            if (tunnelProc.exitCode === null && tunnelProc.signalCode === null) {
                tunnelProc.kill('SIGTERM');
            }
        },
    };
}
