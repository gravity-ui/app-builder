import {createLayoutPlugin, createRenderFunction} from '@gravity-ui/app-layout';
import {ExpressKit} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';

const nodekit = new NodeKit({});

const port = process.env.APP_PORT ? Number(process.env.APP_PORT) : 3030;

const renderLayout = createRenderFunction([
    createLayoutPlugin({
        manifest: 'dist/public/build/assets-manifest.json',
        publicPath: `http://localhost:${port + 1}/build/`,
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
});

app.run();
