import * as vscode from 'vscode';
import { LaTeXCompiler } from './compiler';
import { PreviewPanel } from './previewPanel';
import { FileWatcher } from './fileWatcher';

let compiler: LaTeXCompiler;
let previewPanel: PreviewPanel | undefined;
let fileWatcher: FileWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
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

    let openHtmlCommand = vscode.commands.registerCommand('latex-preview.openHtml', async () => {
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

        try {
            vscode.window.showInformationMessage('Compiling LaTeX document...');
            const htmlPath = await compiler.compile(document.uri);
            
            // Open the HTML file in the default browser
            await vscode.env.openExternal(vscode.Uri.file(htmlPath));
            
            vscode.window.showInformationMessage('HTML file opened in browser');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to compile LaTeX: ${error}`);
        }
    });

    let openHtmlInVSCodeCommand = vscode.commands.registerCommand('latex-preview.openHtmlInVSCode', async () => {
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

        try {
            vscode.window.showInformationMessage('Compiling LaTeX document...');
            const htmlPath = await compiler.compile(document.uri, true); // true = no extra CSS
            
            // Open the HTML file in VS Code
            const htmlDocument = await vscode.workspace.openTextDocument(htmlPath);
            await vscode.window.showTextDocument(htmlDocument);
            
            vscode.window.showInformationMessage('HTML file opened in VS Code');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to compile LaTeX: ${error}`);
        }
    });

    context.subscriptions.push(showPreviewCommand);
    context.subscriptions.push(refreshPreviewCommand);
    context.subscriptions.push(openHtmlCommand);
    context.subscriptions.push(openHtmlInVSCodeCommand);
    context.subscriptions.push({
        dispose: () => {
            fileWatcher?.dispose();
        }
    });
}

export function deactivate() {
    fileWatcher?.dispose();
}