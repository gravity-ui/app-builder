import type Typescript from 'typescript';

import {watch} from './watch';

describe('TypeScript watch', () => {
    it('overrides tsBuildInfoFile only for the root project', () => {
        const configPath = '/project/src/server/tsconfig.json';
        const referencedConfigPath = '/project/packages/shared/tsconfig.json';
        const tsBuildInfoFile = '/project/dist/server/.tsbuildinfo';
        const getParsedCommandLineOfConfigFile = jest.fn(
            (_fileName: string, _options?: Typescript.CompilerOptions) => ({
                options: {},
                fileNames: [],
                errors: [],
            }),
        );
        const host = {
            readFile: jest.fn(),
            createProgram: jest.fn(),
        };
        const build = jest.fn();
        const ts = {
            version: '5.6.3',
            sys: {
                newLine: '\n',
                useCaseSensitiveFileNames: true,
                getCurrentDirectory: () => '/project',
                readDirectory: jest.fn(),
                fileExists: jest.fn(),
                readFile: jest.fn(),
            },
            findConfigFile: jest.fn(
                (searchPath: string, _fileExists: unknown, fileName = 'tsconfig.json') =>
                    `${searchPath}/${fileName}`,
            ),
            getParsedCommandLineOfConfigFile,
            createEmitAndSemanticDiagnosticsBuilderProgram: jest.fn(),
            createSolutionBuilderWithWatchHost: jest.fn(() => host),
            createSolutionBuilderWithWatch: jest.fn((solutionHost) => {
                solutionHost.getParsedCommandLine(configPath);
                solutionHost.getParsedCommandLine(referencedConfigPath);
                return {build};
            }),
        } as unknown as typeof Typescript;
        const logger = {
            message: jest.fn(),
            verbose: jest.fn(),
            status: jest.fn(),
            clearLine: jest.fn(),
            colors: {dim: (value: string) => value},
            isVerbose: false,
        };

        watch(ts, '/project/src/server', {
            logger: logger as never,
            tsBuildInfoFile,
        });

        expect(getParsedCommandLineOfConfigFile).toHaveBeenNthCalledWith(
            1,
            configPath,
            expect.objectContaining({tsBuildInfoFile, noEmit: false}),
            expect.any(Object),
        );
        expect(getParsedCommandLineOfConfigFile).toHaveBeenNthCalledWith(
            2,
            referencedConfigPath,
            expect.objectContaining({noEmit: false}),
            expect.any(Object),
        );
        expect(getParsedCommandLineOfConfigFile.mock.calls[1]?.[1]).not.toHaveProperty(
            'tsBuildInfoFile',
        );
        expect(build).toHaveBeenCalledTimes(1);
    });
});
