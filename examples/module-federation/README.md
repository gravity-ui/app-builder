# Module Federation example

End-to-end Module Federation setup powered by `@gravity-ui/app-builder`: one
host shell with route-driven navigation in the header and three independent
microfrontends, each built and served by its own `app-builder` instance.

## Layout

```
examples/module-federation/
├── package.json          # workspace root with run-all scripts
├── tsconfig.json         # shared TS settings
├── host/                 # root application (port 3000)
├── mf-products/          # microfrontend (port 3001) → /products
├── mf-cart/              # microfrontend (port 3002) → /cart
└── mf-profile/           # microfrontend (port 3003) → /profile
```

Every app is a self-contained `app-builder` project — its own
`app-builder.config.ts`, `src/ui/tsconfig.json`,
`src/ui/entries/<federation-name>.tsx`, `src/ui/App.tsx` and
`public/index.html`. The workspace `package.json` wires them together via
`npm-run-all` scripts.

> ⚠ Important: `app-builder` requires the entry file to be named exactly the
> same as the federation name. That is why the entry files are
> `host.tsx`, `mf_products.tsx`, `mf_cart.tsx` and `mf_profile.tsx`
> (not `main.tsx`).

## How the federation is configured

Each microfrontend `exposes: { './App': './src/ui/App' }` under a unique
federation name (`mf_products`, `mf_cart`, `mf_profile`).

The host declares them via `originalRemotes` so the URLs are explicit and the
dev environment does not depend on a discovery mechanism:

```ts
moduleFederation: {
    name: 'host',
    originalRemotes: {
        mf_products:
            'mf_products@http://localhost:3001/build/mf_products/mf-manifest.json',
        mf_cart: 'mf_cart@http://localhost:3002/build/mf_cart/mf-manifest.json',
        mf_profile:
            'mf_profile@http://localhost:3003/build/mf_profile/mf-manifest.json',
    },
    shared: {
        react: {singleton: true, requiredVersion: false, eager: true},
        'react-dom': {singleton: true, requiredVersion: false, eager: true},
        'react-router': {singleton: true, requiredVersion: false, eager: true},
    },
},
```

Routes are switched inside `host/src/ui/App.tsx` with `react-router`:

```tsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/products/*" element={<ProductsApp />} />
  <Route path="/cart/*" element={<CartApp />} />
  <Route path="/profile/*" element={<ProfileApp />} />
</Routes>
```

`ProductsApp`, `CartApp` and `ProfileApp` are loaded with `React.lazy` from
their federated entries (`import('mf_products/App')` etc.). Ambient module
declarations for these specifiers live in `host/src/ui/remotes.d.ts`.

`HashRouter` is used to keep the example dependency-free of any custom
dev-server history fallback — open `http://localhost:3000/#/products` and you
will see the products remote rendered inside the host.

### `index.html`

`app-builder` does not ship its own HTML generation, so each app appends an
`HtmlRspackPlugin` through the `client.rspack` hook. The plugin reads
`public/index.html` and writes the result to `dist/public/index.html` (i.e.
two levels up from the MF asset folder).

To make sure the generated HTML is available from the dev server (which
otherwise serves bundles from memory), each `devServer` config opts the
HTML file into disk emission:

```ts
devServer: {
    port: 3001,
    writeToDisk: (target) => target.endsWith('index.html'),
},
```

## Install

```sh
pnpm install
```

## Run all four apps in dev

```sh
pnpm dev
```

The remotes start before the host (host depends on their manifests). Open:

| App         | URL                             |
| ----------- | ------------------------------- |
| host        | http://localhost:3000           |
| mf-products | http://localhost:3001 (preview) |
| mf-cart     | http://localhost:3002 (preview) |
| mf-profile  | http://localhost:3003 (preview) |

You can also start them individually:

```sh
pnpm dev:products
pnpm dev:cart
pnpm dev:profile
pnpm dev:host
```

## Production build

```sh
pnpm build
```

Outputs land in each app's `dist/public/`:

```
host/dist/public/index.html
host/dist/public/build/host/...
mf-products/dist/public/build/mf_products/mf-manifest.json
mf-cart/dist/public/build/mf_cart/mf-manifest.json
mf-profile/dist/public/build/mf_profile/mf-manifest.json
```

For a quick preview of the production bundle:

```sh
pnpm preview:products
pnpm preview:cart
pnpm preview:profile
pnpm preview:host
```

(`preview:*` uses `npx serve` so all four servers serve their `dist/public/`
folders on the same ports as in dev.)
