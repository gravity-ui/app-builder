import pluginTester from 'babel-plugin-tester';
import plugin from './babel-plugin-replace-paths';

pluginTester({
    plugin,
    tests: {
        'replace local scss paths': {
            code: `
                import "./test.scss";
                import './test.scss';
            `,
            output: `
                import './test.css';
                import './test.css';
            `,
        },
        'do not replace global scss paths': {
            code: 'import "my-lib/test.scss";',
            output: "import 'my-lib/test.scss';",
        },
        'replace local svg paths inside assets folder': {
            code: `
                import abc from '../../assets/icons/abc.svg';
                export {default as abc} from '../../assets/icons/abc.svg';
                const AbcIcon = import('../../assets/icons/abc.svg');
            `,
            output: `
                import abc from '../assets/icons/abc';
                export {default as abc} from '../assets/icons/abc';
                const AbcIcon = import('../assets/icons/abc');
            `,
        },
    },
});
