import type Typescript from 'typescript';
import * as path from 'node:path';
import * as semver from 'semver';

export function createTransformPathsToLocalModules(ts: typeof Typescript) {
    function resolveModule(
        module: string,
        sourceFileName: string,
        options: Typescript.CompilerOptions,
    ) {
        if (module.startsWith('.')) {
            return undefined;
        }
        const resolve = ts.resolveModuleName(module, sourceFileName, options, ts.sys);
        if (resolve.resolvedModule && !resolve.resolvedModule.isExternalLibraryImport) {
            const relativePath = path.relative(
                path.dirname(sourceFileName),
                resolve.resolvedModule.resolvedFileName,
            );
            const parsed = path.parse(relativePath);
            const newFilePath = path.join(parsed.dir, parsed.name === 'index' ? '' : parsed.name);
            return newFilePath.startsWith('.') ? newFilePath : `./${newFilePath}`;
        }
        return undefined;
    }

    function isDynamicImport(node: Typescript.Node): node is Typescript.CallExpression {
        return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
    }

    function isRequire(node: Typescript.Node): node is Typescript.CallExpression {
        return (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'require'
        );
    }

    function transformFile(
        sourceFile: Typescript.SourceFile,
        context: Typescript.TransformationContext,
    ) {
        const options = context.getCompilerOptions();
        return ts.visitNode(sourceFile, visitor);

        function visitor<T extends Typescript.Node>(node: T): T {
            let modulePath;
            if (
                (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
                node.moduleSpecifier &&
                ts.isStringLiteral(node.moduleSpecifier)
            ) {
                modulePath = node.moduleSpecifier.text;
            } else if (
                (isDynamicImport(node) || isRequire(node)) &&
                node.arguments[0] &&
                ts.isStringLiteral(node.arguments[0])
            ) {
                modulePath = node.arguments[0].text;
            } else if (
                ts.isImportTypeNode(node) &&
                ts.isLiteralTypeNode(node.argument) &&
                ts.isStringLiteral(node.argument.literal)
            ) {
                modulePath = node.argument.literal.text;
            }

            if (modulePath) {
                const resolvedPath = resolveModule(modulePath, sourceFile.fileName, options);
                if (resolvedPath) {
                    if (ts.isImportDeclaration(node)) {
                        const newNode = updateImportDeclaration(ts, node, context, resolvedPath);
                        ts.setSourceMapRange(newNode, ts.getSourceMapRange(node));
                        return newNode as unknown as T;
                    }
                    if (ts.isExportDeclaration(node)) {
                        const newNode = updateExportDeclaration(ts, node, context, resolvedPath);
                        ts.setSourceMapRange(newNode, ts.getSourceMapRange(node));
                        return newNode as unknown as T;
                    }
                    if (isDynamicImport(node) || isRequire(node)) {
                        const newStatement = context.factory.updateCallExpression(
                            node,
                            node.expression,
                            node.typeArguments,
                            context.factory.createNodeArray([
                                context.factory.createStringLiteral(resolvedPath),
                            ]),
                        );
                        ts.setSourceMapRange(newStatement, ts.getSourceMapRange(node));
                        return newStatement as unknown as T;
                    }
                    if (ts.isImportTypeNode(node)) {
                        const newNode = updateImportTypeNode(ts, node, context, resolvedPath);
                        ts.setSourceMapRange(newNode, ts.getSourceMapRange(node));
                        return newNode as unknown as T;
                    }
                }
                return node;
            }
            return ts.visitEachChild(node, visitor, context);
        }
    }

    return function transformPathsToLocalModules<T extends Typescript.Node>(
        context: Typescript.TransformationContext,
    ) {
        return (sourceFileOrBundle: T) => {
            if (ts.isSourceFile(sourceFileOrBundle)) {
                return transformFile(sourceFileOrBundle, context) as unknown as T;
            }
            if (ts.isBundle(sourceFileOrBundle)) {
                // don't transform bundles yet
                return sourceFileOrBundle;
            }
            return sourceFileOrBundle;
        };
    };
}

function updateImportDeclaration(
    ts: typeof Typescript,
    node: Typescript.ImportDeclaration,
    context: Typescript.TransformationContext,
    resolvedPath: string,
) {
    if (semver.lt(ts.version, '5.0.0')) {
        // for versions before 5.0.0
        return context.factory.updateImportDeclaration(
            node,
            // @ts-expect-error
            node.decorators,
            node.modifiers,
            node.importClause,
            context.factory.createStringLiteral(resolvedPath),
            // @ts-expect-error
            node.assertClause,
        );
    }
    return context.factory.updateImportDeclaration(
        node,
        node.modifiers,
        node.importClause,
        context.factory.createStringLiteral(resolvedPath),
        node.attributes || node.assertClause,
    );
}

function updateExportDeclaration(
    ts: typeof Typescript,
    node: Typescript.ExportDeclaration,
    context: Typescript.TransformationContext,
    resolvedPath: string,
) {
    if (semver.lt(ts.version, '5.0.0')) {
        // for versions before 5.0.0
        return context.factory.updateExportDeclaration(
            node,
            // @ts-expect-error
            node.decorators,
            node.modifiers,
            node.isTypeOnly,
            node.exportClause,
            context.factory.createStringLiteral(resolvedPath),
            // @ts-expect-error
            node.assertClause,
        );
    }

    return context.factory.updateExportDeclaration(
        node,
        node.modifiers,
        node.isTypeOnly,
        node.exportClause,
        context.factory.createStringLiteral(resolvedPath),
        node.attributes || node.assertClause,
    );
}

function updateImportTypeNode(
    ts: typeof Typescript,
    node: Typescript.ImportTypeNode,
    context: Typescript.TransformationContext,
    resolvedPath: string,
) {
    if (semver.lt(ts.version, '5.0.0')) {
        // for versions before 5.0.0
        return context.factory.updateImportTypeNode(
            node,
            context.factory.createLiteralTypeNode(
                context.factory.createStringLiteral(resolvedPath),
            ),
            // @ts-expect-error
            node.qualifier,
            node.typeArguments,
            node.isTypeOf,
        );
    }
    return context.factory.updateImportTypeNode(
        node,
        context.factory.createLiteralTypeNode(context.factory.createStringLiteral(resolvedPath)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        node.attributes || (node.assertions as any),
        node.qualifier,
        node.typeArguments,
        node.isTypeOf,
    );
}
