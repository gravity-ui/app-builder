interface Window {
    __PUBLIC_PATH__: string;
    __REMOTE_VERSIONS__?: Record<string, string>;
}

interface WorkerGlobalScope {
    __PUBLIC_PATH__: string;
}

declare namespace NodeJS {
    interface ProcessEnv {
        readonly NODE_ENV: 'development' | 'production' | 'test';
        readonly PUBLIC_PATH: string;
        readonly IS_SSR: 'true' | 'false';
    }
}

declare module '*.css';
declare module '*.scss';

type CSSModuleClasses = {readonly [key: string]: string};

declare module '*.module.css' {
    const classes: CSSModuleClasses;
    export default classes;
}

declare module '*.module.scss' {
    const classes: CSSModuleClasses;
    export default classes;
}

declare module '*.bmp' {
    const src: string;
    export default src;
}

declare module '*.gif' {
    const src: string;
    export default src;
}

declare module '*.jpg' {
    const src: string;
    export default src;
}

declare module '*.jpeg' {
    const src: string;
    export default src;
}

declare module '*.png' {
    const src: string;
    export default src;
}

declare module '*.webp' {
    const src: string;
    export default src;
}

declare module '*.ico' {
    const src: string;
    export default src;
}

declare module '*.woff' {
    const src: string;
    export default src;
}

declare module '*.woff2' {
    const src: string;
    export default src;
}

declare module '*.ttf' {
    const src: string;
    export default src;
}

declare module '*.eot' {
    const src: string;
    export default src;
}

declare module '*.worker.ts' {
    class WebpackWorker extends Worker {
        constructor(options?: WorkerOptions);
    }

    export default WebpackWorker;
}

declare module '*.worker.tsx' {
    class WebpackWorker extends Worker {
        constructor(options?: WorkerOptions);
    }

    export default WebpackWorker;
}

declare module '*.worker.js' {
    class WebpackWorker extends Worker {
        constructor(options?: WorkerOptions);
    }

    export default WebpackWorker;
}

declare module '*.worker.jsx' {
    class WebpackWorker extends Worker {
        constructor(options?: WorkerOptions);
    }

    export default WebpackWorker;
}
