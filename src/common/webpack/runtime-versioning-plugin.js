/* global window */

const RuntimeVersioningPlugin = () => {
    return {
        name: 'runtime-versioning-plugin',
        beforeRequest: (args) => {
            if (typeof window.__REMOTE_VERSIONS__ !== 'object') {
                return args;
            }

            args.options.remotes.forEach((remote) => {
                const remoteVersion = window.__REMOTE_VERSIONS__[remote.name];

                if (remoteVersion) {
                    // eslint-disable-next-line no-param-reassign
                    remote.entry = remote.entry.replace('[version]', remoteVersion);
                }
            });

            return args;
        },
    };
};

export default RuntimeVersioningPlugin;
