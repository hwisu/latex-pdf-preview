import * as vscode from 'vscode';
import { LaTeXCompiler } from './compiler';
import { PreviewPanel } from './previewPanel';
import { FileWatcher } from './fileWatcher';

let compiler: LaTeXCompiler;
let previewPanel: PreviewPanel | undefined;
let fileWatcher: FileWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('LaTeX Preview extension is now active!');

    compiler = new LaTeXCompiler();

    let showPreviewCommand = vscode.commands.registerCommand('latex-preview.showPreview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active LaTeX file');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'latex' && document.languageId !== 'tex') {
            vscode.window.showErrorMessage('Active file is not a LaTeX document');
            return;
        }

        await document.save();

        if (!previewPanel) {
            previewPanel = new PreviewPanel(context.extensionUri);
            previewPanel.onDidDispose(() => {
                previewPanel = undefined;
                fileWatcher?.dispose();
                fileWatcher = undefined;
            });
        }

        try {
            vscode.window.showInformationMessage('Compiling LaTeX document...');
            const htmlPath = await compiler.compile(document.uri);
            
            previewPanel.reveal();
            previewPanel.update(htmlPath);

            const config = vscode.workspace.getConfiguration('latex-preview');
            if (config.get<boolean>('autoCompile') && !fileWatcher) {
                fileWatcher = new FileWatcher(document.uri, async () => {
                    try {
                        const htmlPath = await compiler.compile(document.uri);
                        previewPanel?.update(htmlPath);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Compilation error: ${error}`);
                    }
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to compile LaTeX: ${error}`);
        }
    });

    let refreshPreviewCommand = vscode.commands.registerCommand('latex-preview.refreshPreview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !previewPanel) {
            return;
        }

        try {
            const htmlPath = await compiler.compile(editor.document.uri);
            previewPanel.update(htmlPath);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh preview: ${error}`);
        }
    });

    context.subscriptions.push(showPreviewCommand);
    context.subscriptions.push(refreshPreviewCommand);
    context.subscriptions.push({
        dispose: () => {
            fileWatcher?.dispose();
        }
    });
}

export function deactivate() {
    fileWatcher?.dispose();
}