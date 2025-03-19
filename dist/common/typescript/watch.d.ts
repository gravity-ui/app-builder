import type Typescript from 'typescript';
import type { Logger } from '../logger';
export declare function watch(ts: typeof Typescript, projectPath: string, { logger, onAfterFilesEmitted, enableSourceMap, }: {
    logger: Logger;
    onAfterFilesEmitted?: () => void;
    enableSourceMap?: boolean;
}): void;
