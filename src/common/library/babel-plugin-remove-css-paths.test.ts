import pluginTester from 'babel-plugin-tester';
import plugin from './babel-plugin-remove-css-imports';

pluginTester({
    plugin,
    tests: {
        'remove css paths': {
            code: `
                import './test.css';
                import '../path/test.css';
                import 'my-lib/test.css';
                import 'my-lib';
            `,
            output: `
                import 'my-lib';
            `,
        },
    },
});
