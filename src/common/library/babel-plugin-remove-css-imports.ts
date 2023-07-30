import {declare} from '@babel/helper-plugin-utils';

export default declare(function () {
    return {
        visitor: {
            ImportDeclaration(path) {
                const source = path.node.source.value;
                if (source.endsWith('.css')) {
                    path.remove();
                }
            },
        },
    };
});
