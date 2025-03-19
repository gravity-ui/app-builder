export declare function babelPreset(config: {
    newJsxTransform?: boolean;
    isSsr?: boolean;
}): (string | {
    env: {
        modules: boolean;
        bugfixes: boolean;
        targets: {
            node: string;
        } | undefined;
    };
    runtime: {
        version: string;
    };
    typescript: boolean;
    react: {
        runtime: string;
    };
})[];
