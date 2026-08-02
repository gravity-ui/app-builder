# Rspack profiling

`app-builder` can start and finalize Rspack's native tracing when the client uses
`bundler: 'rspack'`. Perfetto traces contain the compiler stages, loader execution,
module graph operations, plugin hooks, and individual module builds emitted by Rspack.

## CLI

Pass a Rspack tracing filter to `dev` or `build`:

```sh
app-builder dev --rspack-profile 'rspack_core=info'
```

The default layer is `perfetto`. The resulting file is written to a unique directory:

```text
.rspack-profile-<timestamp>-<pid>/rspack.pftrace
```

Additional options:

```sh
app-builder dev \
  --rspack-profile 'rspack_core=info' \
  --rspack-trace-layer perfetto \
  --rspack-trace-output first-navigation.pftrace
```

`--rspack-trace-output` is a filename inside the generated profile directory. For the
`logger` layer, `stdout` and `stderr` are also accepted.

> **Rspack 2 note:** the standard Rspack 2 release binding may be built without the native
> `perfetto` feature. In that case app-builder stops profiling with an explicit error. Use
> `--rspack-trace-layer logger` or a Rspack binding built with Perfetto support. Rspack 1.x
> release bindings used in the comparison below support native Perfetto output.

## Environment variables

The official Rspack variables are supported for compatibility with existing tooling:

```sh
RSPACK_PROFILE='rspack_core=info' \
RSPACK_TRACE_LAYER=perfetto \
RSPACK_TRACE_OUTPUT=first-navigation.pftrace \
app-builder dev
```

The corresponding CLI options take precedence over environment variables. The same
options can also be set through the standard `APP_BUILDER_*` CLI environment mapping,
for example `APP_BUILDER_RSPACK_PROFILE`.

## Lifecycle

`app-builder` calls `rspack.experiments.globalTrace.register()` before creating the
compiler. It calls `globalTrace.cleanup()` after a build and before exiting on `SIGINT`
or `SIGTERM`, so stopping a development server with Ctrl+C produces a valid trace.
Cleanup is idempotent.

Profiling is rejected when the selected target does not include a Rspack client. This
prevents creation of empty traces for Webpack, library, and server-only builds.

## Choosing a filter

Start with a scoped filter:

```sh
app-builder dev --rspack-profile 'rspack_core=info'
```

Use `ALL` only for short reproductions. Large applications can generate hundreds of
megabytes and millions of events, and tracing itself can materially slow down a build:

```sh
app-builder dev --rspack-profile ALL
```

For first-navigation profiling:

1. Remove or move the Rspack cache if a cold-cache measurement is required.
2. Start `app-builder dev` with a scoped filter.
3. Open the target page in the browser and wait until the requested lazy compilations finish.
4. Stop the server with Ctrl+C to finalize the trace.
5. Open the `.pftrace` file in [Perfetto UI](https://ui.perfetto.dev/) or query it with
   [Trace Processor](https://perfetto.dev/docs/analysis/trace-processor-sql-syntax).

Example Trace Processor query:

```sql
SELECT
  name,
  count(*) AS calls,
  round(sum(dur) / 1e9, 3) AS total_s,
  round(max(dur) / 1e9, 3) AS max_s
FROM slice
WHERE dur > 0
GROUP BY name
ORDER BY sum(dur) DESC
LIMIT 50;
```
