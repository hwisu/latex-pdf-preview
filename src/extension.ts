import { ExtensionContext, commands, window, workspace } from 'vscode';
import { LaTeXCompiler } from './compiler';
import { FileWatcher } from './fileWatcher';
import { PreviewPanel } from './previewPanel';
import { handleCompilationError } from './utils/errorHandler';

let compiler: LaTeXCompiler, previewPanel: PreviewPanel | undefined, fileWatcher: FileWatcher | undefined;

const validateLatexDocument = () => {
    const editor = window.activeTextEditor;
    if (!editor || !['latex', 'tex'].includes(editor.document.languageId)) {
        window.showErrorMessage('Active file is not a LaTeX document');
        return;
    }
    return editor.document;
};

export function activate(context: ExtensionContext) {
    compiler = new LaTeXCompiler(context);

    const showPreview = commands.registerCommand('latex-preview.showPreview', async () => {
        const document = validateLatexDocument();
        if (!document) return;

        await document.save();
        if (!previewPanel) {
            previewPanel = new PreviewPanel(context.extensionPath);
            previewPanel.onDidDispose(() => { fileWatcher?.dispose(); previewPanel = fileWatcher = undefined; });
        }

        try {
            const pdfPath = await compiler.compile(document.uri);
            previewPanel.update(pdfPath);
            previewPanel.reveal();

            const config = workspace.getConfiguration('latex-preview');
            if (config.get<boolean>('autoCompile')) {
                fileWatcher?.dispose();
                fileWatcher = new FileWatcher(document.uri, async () => {
                    try {
                        const pdfPath = await compiler.compile(document.uri);
                        previewPanel?.update(pdfPath);
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
        if (!window.activeTextEditor || !previewPanel) return;
        try {
            const pdfPath = await compiler.compile(window.activeTextEditor.document.uri);
            previewPanel.update(pdfPath);
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
