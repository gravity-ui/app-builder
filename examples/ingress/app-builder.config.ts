import type {ServiceConfig} from '@gravity-ui/app-builder';
const port = process.env.APP_PORT ? Number(process.env.APP_PORT) : 3030;

export default (): ServiceConfig => {
    return {
        client: {
            newJsxTransform: true,
            devServer: {
                port: port + 1,
            },
        },
        server: {
            port,
        },
    };
};
