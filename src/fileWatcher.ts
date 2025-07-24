import * as vscode from 'vscode';
import * as path from 'path';
import { debounce } from './utils/debounce';

export class FileWatcher {
    private watcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(
        documentUri: vscode.Uri,
        onFileChange: () => void
    ) {
        const pattern = new vscode.RelativePattern(
            vscode.workspace.getWorkspaceFolder(documentUri)!,
            path.relative(vscode.workspace.getWorkspaceFolder(documentUri)!.uri.fsPath, documentUri.fsPath)
        );

        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        const debouncedOnChange = debounce(onFileChange, 1000);

        this.watcher.onDidChange(() => {
            debouncedOnChange();
        }, null, this.disposables);

        const saveDisposable = vscode.workspace.onDidSaveTextDocument(document => {
            if (document.uri.toString() === documentUri.toString()) {
                debouncedOnChange();
            }
        }, null, this.disposables);

        this.disposables.push(saveDisposable);
    }

    dispose(): void {
        this.watcher?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}