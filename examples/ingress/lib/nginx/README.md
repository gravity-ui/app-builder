# @examples/ingress-nginx

A tiny app-builder library that fronts a local `app-builder dev` server with a real nginx on a
remote VM, reached over `ssh -R` reverse tunnels. Generic and topology-agnostic: it **renders** an
nginx config from an explicit param map and **syncs** it over ssh. The actual nginx layout
(server_name, upstreams, SSL) lives with the consumer — see `examples/ingress/templates/nginx.conf.template`.

## Modules

- `src/nginx.ts` — `render(template, params)` (pure `${NAME}` substitution, whitelist = keys of
  `params`; nginx's own `$vars` are left intact) + `DEFAULT_RELOAD_COMMAND`.
- `src/sync.ts` — `sync(config, target)` — pushes the config over ssh (`sudo tee` + reload) and
  opens the reverse forwards (one `ssh` process, one `-R` per tunnel); returns `{stop}`.
- `src/index.ts` — `newNginxIngressListeningHandler(options)` returns `{handle, stop}`: `handle` is
  the `onListening` callback (reads the client dev server's live address; node endpoint from
  `options`), `stop` tears the tunnels down.

## Usage

Build the handler once from options, assign `handle` to `onListening`, and wire `stop` to signals:

```ts
// app-builder.config.ts
import {newNginxIngressListeningHandler} from '@examples/ingress-nginx';

const ingress = newNginxIngressListeningHandler({
  template: 'templates/nginx.conf.template', // your layout, resolved from cwd
  serverName: 'ingress.me.ui.yandex.cloud',
  remote: {
    host: 'me.ui.cloud.yandex.net', // ssh target that runs nginx
    client: {reversePort: 3031}, // VM port (ssh -R bind) → client dev server (/build/)
    server: {reversePort: 3030, socket: 'dist/run/server.sock'}, // VM port → node server
  },
});

process.once('SIGINT', ingress.stop);
process.once('SIGTERM', ingress.stop);

export default {
  client: {devServer: {onListening: ingress.handle}},
  server: {
    /* ... */
  },
};
```

The template gets `APP_SERVER_NAME`, `APP_CLIENT_UPSTREAM` (`127.0.0.1:<client.reversePort>`) and
`APP_SERVER_UPSTREAM` (`127.0.0.1:<server.reversePort>`); pass anything else via `options.params`.

## Requirements on the VM

- nginx with the `common/ssl` / `common/gzip` includes and a cert for `serverName`.
- The remote user can write `configPath` (default `/etc/nginx/sites-enabled/<serverName>.conf`) and
  run `reloadCommand` (default `sudo nginx -s reload`) — e.g. passwordless sudo.
- ssh access. Auth is interactive when the tunnel starts (use an agent / `ControlMaster` to avoid
  repeat prompts).

## Build

`npm run build` (`app-builder build`) → `build/esm` + `build/cjs` + `.d.ts`.
