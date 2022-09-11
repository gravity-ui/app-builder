import type Typescript from 'typescript';
import * as path from 'path';

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
    ): Typescript.SourceFile {
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
                        const newStatement = context.factory.updateImportDeclaration(
                            node,
                            node.decorators,
                            node.modifiers,
                            node.importClause,
                            context.factory.createStringLiteral(resolvedPath),
                            node.assertClause,
                        );
                        ts.setSourceMapRange(newStatement, ts.getSourceMapRange(node));
                        return newStatement as unknown as T;
                    }
                    if (ts.isExportDeclaration(node)) {
                        const newStatement = context.factory.updateExportDeclaration(
                            node,
                            node.decorators,
                            node.modifiers,
                            node.isTypeOnly,
                            node.exportClause,
                            context.factory.createStringLiteral(resolvedPath),
                            node.assertClause,
                        );
                        ts.setSourceMapRange(newStatement, ts.getSourceMapRange(node));
                        return newStatement as unknown as T;
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
                        const newNode = context.factory.updateImportTypeNode(
                            node,
                            context.factory.createLiteralTypeNode(
                                context.factory.createStringLiteral(resolvedPath),
                            ),
                            node.qualifier,
                            node.typeArguments,
                            node.isTypeOf,
                        );
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
