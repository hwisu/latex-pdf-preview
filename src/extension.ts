import { ExtensionContext, Uri, ViewColumn, commands, window, workspace } from 'vscode';
import { LaTeXCompiler } from './compiler';
import { FileWatcher } from './fileWatcher';
import { handleCompilationError } from './utils/errorHandler';

let compiler: LaTeXCompiler, fileWatcher: FileWatcher | undefined;

const validateLatexDocument = () => {
    const editor = window.activeTextEditor;
    if (!editor || !['latex', 'tex'].includes(editor.document.languageId)) {
        window.showErrorMessage('Active file is not a LaTeX document');
        return;
    }
    return editor.document;
};

const openPdfInVscode = async (pdfPath: string) => {
    // Open PDF in VSCode (uses installed PDF extension or built-in viewer)
    await commands.executeCommand('vscode.open', Uri.file(pdfPath), ViewColumn.Beside);
};

export function activate(context: ExtensionContext) {
    compiler = new LaTeXCompiler(context);

    const showPreview = commands.registerCommand('latex-preview.showPreview', async () => {
        const document = validateLatexDocument();
        if (!document) return;

        await document.save();

        try {
            const pdfPath = await compiler.compile(document.uri);
            await openPdfInVscode(pdfPath);

            const config = workspace.getConfiguration('latex-preview');
            if (config.get<boolean>('autoCompile')) {
                fileWatcher?.dispose();
                fileWatcher = new FileWatcher(document.uri, async () => {
                    try {
                        const pdfPath = await compiler.compile(document.uri);
                        // Reopen to refresh (VSCode PDF viewers detect file changes)
                        await openPdfInVscode(pdfPath);
                    } catch (error) {
                        handleCompilationError(error, 'watch');
                    }
                });
            } else {
                fileWatcher?.dispose();
                fileWatcher = undefined;
            }
        } catch (error) {
            handleCompilationError(error, 'compile');
        }
    });

    const refreshPreview = commands.registerCommand('latex-preview.refreshPreview', async () => {
        if (!window.activeTextEditor) return;
        try {
            const pdfPath = await compiler.compile(window.activeTextEditor.document.uri);
            await openPdfInVscode(pdfPath);
        } catch (error) {
            handleCompilationError(error, 'refresh');
        }
    });

    context.subscriptions.push(showPreview, refreshPreview, { dispose: () => fileWatcher?.dispose() });
}

export function deactivate() {
    fileWatcher?.dispose();
    compiler?.dispose();
}
