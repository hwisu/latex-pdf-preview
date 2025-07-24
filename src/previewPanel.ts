import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class PreviewPanel {
    private static readonly viewType = 'latexPreview';
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    private onDisposeCallback?: () => void;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public reveal(): void {
        if (!this.panel) {
            this.createPanel();
        } else {
            this.panel.reveal(vscode.ViewColumn.Beside);
        }
    }

    public update(htmlPath: string): void {
        if (!this.panel) {
            this.createPanel();
        }

        if (this.panel) {
            this.panel.webview.html = this.getWebviewContent(htmlPath);
        }
    }

    public onDidDispose(callback: () => void): void {
        this.onDisposeCallback = callback;
    }

    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            PreviewPanel.viewType,
            'LaTeX Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file('/')]
            }
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.onDidChangeViewState(
            e => {
                if (this.panel?.visible) {
                    vscode.commands.executeCommand('setContext', 'latexPreviewFocus', true);
                } else {
                    vscode.commands.executeCommand('setContext', 'latexPreviewFocus', false);
                }
            },
            null,
            this.disposables
        );
    }

    private getWebviewContent(htmlPath: string): string {
        if (!this.panel) {
            return '';
        }

        try {
            // Read the HTML content
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            const htmlDir = path.dirname(htmlPath);
            const htmlUri = this.panel.webview.asWebviewUri(vscode.Uri.file(htmlDir));

            // Process the HTML to fix resource paths
            let processedHtml = htmlContent;
            
            // Replace relative paths with webview URIs
            processedHtml = processedHtml.replace(
                /(src|href)=["'](?!https?:\/\/)([^"']+)["']/g, 
                `$1="${htmlUri}/$2"`
            );

            // Add CSS reset and minimal VS Code integration
            const cssReset = `
<style>
    /* CSS Reset to prevent VS Code webview interference */
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    
    /* Reset all possible VS Code overrides */
    body, div, span, h1, h2, h3, h4, h5, h6, p, a, em, strong, 
    pre, code, table, tbody, tfoot, thead, tr, th, td {
        all: initial;
        display: revert;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        text-align: inherit;
        color: inherit;
        line-height: inherit;
    }
    
    /* Re-enable basic display properties */
    div { display: block; }
    span { display: inline; }
    table { display: table; }
    tr { display: table-row; }
    td { display: table-cell; }
    a { display: inline; cursor: pointer; }
    
    /* Only apply VS Code colors to body background */
    body {
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        width: 100%;
        height: 100%;
        overflow: auto;
    }
    
    /* Let LaTeX styles take precedence */
    .center { text-align: center !important; }
    .center * { text-align: center !important; }
</style>\n</head>`;
            processedHtml = processedHtml.replace('</head>', cssReset);

            return processedHtml;
        } catch (error) {
            return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .error {
            color: #f48771;
            border: 1px solid #f48771;
            padding: 15px;
            border-radius: 5px;
            background-color: rgba(244, 135, 113, 0.1);
        }
    </style>
</head>
<body>
    <div class="error">
        <h2>Error loading preview</h2>
        <p>${error}</p>
        <p>Path: ${htmlPath}</p>
    </div>
</body>
</html>`;
        }
    }

    private dispose(): void {
        vscode.commands.executeCommand('setContext', 'latexPreviewFocus', false);
        
        this.panel = undefined;

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }

        if (this.onDisposeCallback) {
            this.onDisposeCallback();
        }
    }
}