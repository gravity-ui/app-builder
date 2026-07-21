import path from 'path';

export const APP_ASSETS_MANIFEST_FILE: string | undefined = 'assets-manifest.json';
export const APP_OUTPUT_PATH: string | undefined = 'dist/public/build';
export const APP_MANIFEST = path.join(APP_OUTPUT_PATH, APP_ASSETS_MANIFEST_FILE);

// APP_PORT and APP_SOCKET are interchangeable
// one of APP_PORT or APP_SOCKET should be present
// APP_PORT wins over APP_SOCKET
export const APP_PORT: number | undefined = undefined;
export const APP_SOCKET: string | undefined = 'dist/run/server.sock';

export const APP_PUBLIC_PATH: string | undefined = '/build/';
