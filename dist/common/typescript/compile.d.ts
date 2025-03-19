import type Typescript from 'typescript';
import type { Logger } from '../logger';
interface CompileOptions {
    projectPath: string;
    configFileName?: string;
    logger: Logger;
    optionsToExtend?: Typescript.CompilerOptions;
}
export declare function compile(ts: typeof Typescript, { projectPath, configFileName, optionsToExtend, logger }: CompileOptions): void;
export {};
