import StatoscopeWebpackPlugin from '@statoscope/webpack-plugin';

type StatoscopePluginConstructor = typeof import('@statoscope/webpack-plugin').default;
type StatoscopePluginImport = StatoscopePluginConstructor | {default: StatoscopePluginConstructor};

export function resolveStatoscopePlugin(
    importedPlugin: StatoscopePluginImport,
): StatoscopePluginConstructor {
    return typeof importedPlugin === 'function' ? importedPlugin : importedPlugin.default;
}

export const StatoscopePlugin = resolveStatoscopePlugin(StatoscopeWebpackPlugin);
