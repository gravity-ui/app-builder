import {pickSwcOptions} from './options.js';

it('forwards only the supported SWC options', () => {
    const options = {rootDir: 'src', copyFiles: true, logger: 'custom', outputPath: '/tmp'};
    expect(JSON.parse(JSON.stringify(pickSwcOptions(options)))).toEqual({
        rootDir: 'src',
        copyFiles: true,
    });
});
