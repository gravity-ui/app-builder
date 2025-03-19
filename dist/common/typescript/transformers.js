"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransformPathsToLocalModules = createTransformPathsToLocalModules;
const path = __importStar(require("node:path"));
const semver = __importStar(require("semver"));
function createTransformPathsToLocalModules(ts) {
    function resolveModule(module, sourceFileName, options) {
        if (module.startsWith('.')) {
            return undefined;
        }
        const resolve = ts.resolveModuleName(module, sourceFileName, options, ts.sys);
        if (resolve.resolvedModule && !resolve.resolvedModule.isExternalLibraryImport) {
            const relativePath = path.relative(path.dirname(sourceFileName), resolve.resolvedModule.resolvedFileName);
            const parsed = path.parse(relativePath);
            const newFilePath = path.join(parsed.dir, parsed.name === 'index' ? '' : parsed.name);
            return newFilePath.startsWith('.') ? newFilePath : `./${newFilePath}`;
        }
        return undefined;
    }
    function isDynamicImport(node) {
        return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
    }
    function isRequire(node) {
        return (ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'require');
    }
    function transformFile(sourceFile, context) {
        const options = context.getCompilerOptions();
        return ts.visitNode(sourceFile, visitor);
        function visitor(node) {
            let modulePath;
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
                node.moduleSpecifier &&
                ts.isStringLiteral(node.moduleSpecifier)) {
                modulePath = node.moduleSpecifier.text;
            }
            else if ((isDynamicImport(node) || isRequire(node)) &&
                node.arguments[0] &&
                ts.isStringLiteral(node.arguments[0])) {
                modulePath = node.arguments[0].text;
            }
            else if (ts.isImportTypeNode(node) &&
                ts.isLiteralTypeNode(node.argument) &&
                ts.isStringLiteral(node.argument.literal)) {
                modulePath = node.argument.literal.text;
            }
            if (modulePath) {
                const resolvedPath = resolveModule(modulePath, sourceFile.fileName, options);
                if (resolvedPath) {
                    if (ts.isImportDeclaration(node)) {
                        const newNode = updateImportDeclaration(ts, node, context, resolvedPath);
                        ts.setSourceMapRange(newNode, ts.getSourceMapRange(node));
                        return newNode;
                    }
                    if (ts.isExportDeclaration(node)) {
                        const newNode = updateExportDeclaration(ts, node, context, resolvedPath);
                        ts.setSourceMapRange(newNode, ts.getSourceMapRange(node));
                        return newNode;
                    }
                    if (isDynamicImport(node) || isRequire(node)) {
                        const newStatement = context.factory.updateCallExpression(node, node.expression, node.typeArguments, context.factory.createNodeArray([
                            context.factory.createStringLiteral(resolvedPath),
                        ]));
                        ts.setSourceMapRange(newStatement, ts.getSourceMapRange(node));
                        return newStatement;
                    }
                    if (ts.isImportTypeNode(node)) {
                        const newNode = updateImportTypeNode(ts, node, context, resolvedPath);
                        ts.setSourceMapRange(newNode, ts.getSourceMapRange(node));
                        return newNode;
                    }
                }
                return node;
            }
            return ts.visitEachChild(node, visitor, context);
        }
    }
    return function transformPathsToLocalModules(context) {
        return (sourceFileOrBundle) => {
            if (ts.isSourceFile(sourceFileOrBundle)) {
                return transformFile(sourceFileOrBundle, context);
            }
            if (ts.isBundle(sourceFileOrBundle)) {
                // don't transform bundles yet
                return sourceFileOrBundle;
            }
            return sourceFileOrBundle;
        };
    };
}
function updateImportDeclaration(ts, node, context, resolvedPath) {
    if (semver.lt(ts.version, '5.0.0')) {
        // for versions before 5.0.0
        return context.factory.updateImportDeclaration(node, 
        // @ts-expect-error
        node.decorators, node.modifiers, node.importClause, context.factory.createStringLiteral(resolvedPath), 
        // @ts-expect-error
        node.assertClause);
    }
    return context.factory.updateImportDeclaration(node, node.modifiers, node.importClause, context.factory.createStringLiteral(resolvedPath), node.attributes || node.assertClause);
}
function updateExportDeclaration(ts, node, context, resolvedPath) {
    if (semver.lt(ts.version, '5.0.0')) {
        // for versions before 5.0.0
        return context.factory.updateExportDeclaration(node, 
        // @ts-expect-error
        node.decorators, node.modifiers, node.isTypeOnly, node.exportClause, context.factory.createStringLiteral(resolvedPath), 
        // @ts-expect-error
        node.assertClause);
    }
    return context.factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, context.factory.createStringLiteral(resolvedPath), node.attributes || node.assertClause);
}
function updateImportTypeNode(ts, node, context, resolvedPath) {
    if (semver.lt(ts.version, '5.0.0')) {
        // for versions before 5.0.0
        return context.factory.updateImportTypeNode(node, context.factory.createLiteralTypeNode(context.factory.createStringLiteral(resolvedPath)), 
        // @ts-expect-error
        node.qualifier, node.typeArguments, node.isTypeOf);
    }
    return context.factory.updateImportTypeNode(node, context.factory.createLiteralTypeNode(context.factory.createStringLiteral(resolvedPath)), 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.attributes || node.assertions, node.qualifier, node.typeArguments, node.isTypeOf);
}
