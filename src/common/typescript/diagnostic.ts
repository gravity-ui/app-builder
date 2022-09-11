import type Typescript from 'typescript';
import path from 'path';

import {colors} from '../logger/colors';

export function formatDiagnosticBrief(
    ts: typeof Typescript,
    diagnostic: Typescript.Diagnostic,
    host: Typescript.FormatDiagnosticsHost,
) {
    let output = '';
    if (diagnostic.file) {
        const {file, start} = diagnostic;
        output += formatLocation(file, start ?? 0);
        output += ' - ';
    }

    output += categoryColor(diagnostic.category)(ts.DiagnosticCategory[diagnostic.category]);
    output += colors.grey(` TS${diagnostic.code}: `);
    output += ts.flattenDiagnosticMessageText(diagnostic.messageText, host.getNewLine());

    return output;

    function formatLocation(file: Typescript.SourceFile, start: number) {
        const {line, character} = ts.getLineAndCharacterOfPosition(file, start);
        const filePath = path.relative(process.cwd(), file.fileName);
        return (
            colors.cyanBright(filePath) +
            ':' +
            colors.yellowBright(line + 1) +
            ':' +
            colors.yellowBright(character + 1)
        );
    }

    function categoryColor(category: Typescript.DiagnosticCategory) {
        switch (category) {
            case ts.DiagnosticCategory.Error: {
                return colors.redBright;
            }
            case ts.DiagnosticCategory.Warning: {
                return colors.yellowBright;
            }
            case ts.DiagnosticCategory.Suggestion: {
                return colors.magentaBright;
            }
            default: {
                return colors;
            }
        }
    }
}
