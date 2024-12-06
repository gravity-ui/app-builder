import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import cookieParser from 'cookie-parser';
import express from 'express';
import * as ReactDOM from 'react-dom/server';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../public/build/assets-manifest.json'), 'utf-8'),
);
const ssrManifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../ssr/assets-manifest.json'), 'utf-8'),
);

const cssAssets = manifest.entrypoints.main.assets.css ?? [];
const links = cssAssets.map((v: string) => ({rel: 'stylesheet', href: `/build/${v}`}));

const app = express();

app.use(cookieParser());
app.use('/build', express.static(path.join(__dirname, '../public/build')));

app.get('/', async (req, res) => {
    const {render} = await import('../ssr/' + ssrManifest['main.mjs']);
    const theme = getUserTheme(req);
    const {pipe} = ReactDOM.renderToPipeableStream(render({links, theme}), {
        bootstrapScripts: manifest.entrypoints.main.assets.js.map((v: string) => `/build/${v}`),
        bootstrapScriptContent: `window.links = ${JSON.stringify(links)};`,
        onShellReady() {
            res.setHeader('content-type', 'text/html');
            pipe(res);
        },
    });
});

const port = Number(process.env.APP_PORT || 3015);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

function getUserTheme(req: express.Request) {
    const cookie = req.cookies['theme-storage'];
    try {
        const {
            state: {theme},
        } = JSON.parse(cookie);
        return theme;
    } catch {
        return 'light';
    }
}
