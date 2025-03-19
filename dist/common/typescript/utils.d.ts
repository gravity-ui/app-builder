import type Typescript from 'typescript';
import type { Logger } from '../logger';
export declare function getTsProjectConfigPath(ts: typeof Typescript, projectPath: string, filename?: string): string;
export declare function getTsProjectConfig(ts: typeof Typescript, projectPath: string, filename?: string, optionsToExtend?: Typescript.CompilerOptions): Typescript.ParsedCommandLine;
export declare function displayFilename(originalFunc: (path: string, encoding?: string) => string | undefined, operationName: string, logger: Logger): {
    (path: string, encoding?: string | undefined): string | undefined;
    originalFunc: (path: string, encoding?: string) => string | undefined;
    enableDisplay(): void;
    disableDisplay(): number;
};
export declare function onHostEvent<F extends string, T extends {
    [key in F]?: (...args: any[]) => any;
}>(host: T, functionName: F, before?: (...args: Parameters<NonNullable<T[F]>>) => void, after?: (res: ReturnType<NonNullable<T[F]>>) => void): void;
export declare function resolveTypescript(): string;
