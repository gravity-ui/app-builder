import {StatoscopePlugin, resolveStatoscopePlugin} from './statoscope-plugin.js';

describe('Statoscope plugin import', () => {
    it('resolves the constructor from the installed CommonJS package', () => {
        expect(typeof StatoscopePlugin).toBe('function');
        expect(() => new StatoscopePlugin({open: false})).not.toThrow();
    });

    it('keeps a constructor exported directly', () => {
        expect(resolveStatoscopePlugin(StatoscopePlugin)).toBe(StatoscopePlugin);
    });

    it('unwraps a constructor exposed as a default export', () => {
        expect(resolveStatoscopePlugin({default: StatoscopePlugin})).toBe(StatoscopePlugin);
    });
});
