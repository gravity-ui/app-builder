type Pattern = RegExp | ((v: string) => boolean) | string;
export interface NodeExternalsOptions {
    noExternal?: Pattern | Pattern[];
    module?: boolean;
}
export declare function nodeExternals({ noExternal, module }: NodeExternalsOptions): (data: {
    request?: string;
    dependencyType?: string;
}) => Promise<string | undefined>;
export {};
