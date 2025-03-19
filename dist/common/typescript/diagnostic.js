"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDiagnosticBrief = formatDiagnosticBrief;
const path = __importStar(require("node:path"));
const colors_1 = require("../logger/colors");
function formatDiagnosticBrief(ts, diagnostic, host) {
    let output = '';
    if (diagnostic.file) {
        const { file, start } = diagnostic;
        output += formatLocation(file, start ?? 0);
        output += ' - ';
    }
    output += categoryColor(diagnostic.category)(ts.DiagnosticCategory[diagnostic.category]);
    output += colors_1.colors.grey(` TS${diagnostic.code}: `);
    output += ts.flattenDiagnosticMessageText(diagnostic.messageText, host.getNewLine());
    return output;
    function formatLocation(file, start) {
        const { line, character } = ts.getLineAndCharacterOfPosition(file, start);
        const filePath = path.relative(process.cwd(), file.fileName);
        return (colors_1.colors.cyanBright(filePath) +
            ':' +
            colors_1.colors.yellowBright(line + 1) +
            ':' +
            colors_1.colors.yellowBright(character + 1));
    }
    function categoryColor(category) {
        switch (category) {
            case ts.DiagnosticCategory.Error: {
                return colors_1.colors.redBright;
            }
            case ts.DiagnosticCategory.Warning: {
                return colors_1.colors.yellowBright;
            }
            case ts.DiagnosticCategory.Suggestion: {
                return colors_1.colors.magentaBright;
            }
            default: {
                return colors_1.colors;
            }
        }
    }
}
