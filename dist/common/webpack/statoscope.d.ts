import { Compiler } from 'webpack';
import { ExtensionDescriptor } from '@statoscope/stats/spec/extension';
import CompressedExtensionGenerator, { CompressorOrPreset, Format, Payload } from '@statoscope/stats-extension-compressed/dist/generator';
import { StatsExtensionWebpackAdapter } from '@statoscope/webpack-model';
export declare class RspackCompressedExtension implements StatsExtensionWebpackAdapter<Payload> {
    compressor: CompressorOrPreset;
    descriptor: ExtensionDescriptor;
    compressedExtensionGenerator: CompressedExtensionGenerator;
    constructor(compressor: CompressorOrPreset);
    getExtension(): Format;
    handleCompiler(compiler: Compiler): void;
}
