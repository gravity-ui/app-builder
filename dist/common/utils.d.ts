export declare function createRunFolder(): void;
export declare function shouldCompileTarget(target: 'client' | 'server' | undefined, targetName: string): boolean;
export declare function getCacheDir(): Promise<string>;
export declare function getPort({ port }: {
    port: number;
}): Promise<number>;
export declare function deferredPromise<T>(): {
    promise: Promise<T | undefined>;
    resolve: (value?: T) => void;
    reject: (reason?: unknown) => void;
};
