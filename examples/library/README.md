# Library example

This workspace package exercises the `app-builder` library pipeline.

```bash
pnpm --filter @examples/library build
```

The build produces ESM, CommonJS, type declarations, compiled styles, and an SVG React component.
The verification step also checks that published JavaScript:

- uses the automatic JSX runtime;
- preserves modern JavaScript syntax;
- does not import `core-js` or `@babel/runtime`;
- does not contain legacy Babel helpers;
- resolves TypeScript path aliases and rewrites local SCSS imports to CSS.
