import {declare} from '@babel/helper-plugin-utils';

const svgPathRe = /^\.\.\/(.*)\/assets\/(.*)\.svg$/;
export default declare(function (api) {
    return {
        visitor: {
            ImportDeclaration(path) {
                const source = path.node.source.value;
                if (source.startsWith('.') && source.endsWith('.scss')) {
                    path.node.source.value = source.slice(0, -4) + 'css';
                } else {
                    const match = source.match(svgPathRe);
                    if (match) {
                        path.node.source.value = `${match[1]}/assets/${match[2]}`;
                    }
                }
            },
            ExportNamedDeclaration(path) {
                const sourceNode = path.node.source;
                const specifier = path.node.specifiers[0];
                if (
                    api.types.isStringLiteral(sourceNode) &&
                    api.types.isExportSpecifier(specifier) &&
                    specifier.local.name === 'default'
                ) {
                    const match = sourceNode.value.match(svgPathRe);
                    if (match) {
                        sourceNode.value = `${match[1]}/assets/${match[2]}`;
                    }
                }
            },
            CallExpression(path) {
                const firstArgument = path.node.arguments[0];
                if (
                    path.node.callee.type === 'Import' &&
                    api.types.isStringLiteral(firstArgument)
                ) {
                    const match = firstArgument.value.match(svgPathRe);
                    if (match) {
                        firstArgument.value = `${match[1]}/assets/${match[2]}`;
                    }
                }
            },
        },
    };
});
