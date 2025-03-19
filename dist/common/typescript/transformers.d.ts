import type Typescript from 'typescript';
export declare function createTransformPathsToLocalModules(ts: typeof Typescript): <T extends Typescript.Node>(context: Typescript.TransformationContext) => (sourceFileOrBundle: T) => T;
