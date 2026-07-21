import {createLayoutPlugin, createRenderFunction} from '@gravity-ui/app-layout';
import {ExpressKit} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';

import {APP_PORT, APP_PUBLIC_PATH, APP_SOCKET} from './config/app-builder';

const nodekit = new NodeKit({
    config: {
        appPort: APP_PORT,
        appSocket: APP_SOCKET,
    },
});

const renderLayout = createRenderFunction([
    createLayoutPlugin({
        manifest: 'dist/public/build/assets-manifest.json',
        publicPath: APP_PUBLIC_PATH,
    }),
]);

const app = new ExpressKit(nodekit, {
    'GET /': (_, res) => {
        res.send(
            renderLayout({
                title: 'ingress',
                pluginsOptions: {layout: {name: 'ingress-app'}},
            }),
        );
    },
    'POST /hello': (req, res) => {
        res.send(`Hello, ${req.body.name ?? 'World'}!`);
    },
});

app.run();
