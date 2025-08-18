import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Disposable, Uri, ViewColumn, WebviewPanel, env, window } from 'vscode';

export class PreviewPanel {
    private panel?: WebviewPanel;
    private disposables: Disposable[] = [];
    private onDisposeCallback?: () => void;

    constructor(private extensionPath: string) {}

    reveal = () => this.panel ? this.panel.reveal(ViewColumn.Beside) : this.createPanel();

    update = (pdfPath: string) => {
        !this.panel && this.createPanel();
        if (this.panel && existsSync(pdfPath)) {
            const webview = this.panel.webview;
            const nonce = this.getNonce();
            const cspSource = webview.cspSource;
            const pdfjsDir = Uri.file(join(this.extensionPath, 'node_modules', 'pdfjs-dist', 'build'));
            const pdfjsUri = webview.asWebviewUri(Uri.file(join(pdfjsDir.fsPath, 'pdf.min.js')));
            const workerUri = webview.asWebviewUri(Uri.file(join(pdfjsDir.fsPath, 'pdf.worker.min.js')));
            const pdfBase64 = readFileSync(pdfPath).toString('base64');
            this.panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data: blob:; script-src ${cspSource} 'nonce-${nonce}'; style-src ${cspSource} 'nonce-${nonce}';">
    <style nonce="${nonce}">
        body { margin: 0; padding: 0; background: #1e1e1e; overflow-y: auto; text-align: center; }
        #container { padding: 20px; }
        .page-canvas { display: block; margin: 0 auto 20px auto; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3); }
        .controls { position: fixed; top: 10px; right: 10px; background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 5px; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; z-index: 1000; }
        button { background: #007ACC; color: white; border: none; padding: 5px 10px; margin: 0 5px; border-radius: 3px; cursor: pointer; }
        button:hover { background: #005a9e; }
    </style>
</head>
<body>
    <div class="controls">
        <button id="zoomOut">-</button>
        <span style="margin: 0 10px;">Zoom</span>
        <button id="zoomIn">+</button>
        <button id="fitWidth">Fit Width</button>
    </div>
    <div id="container"></div>
    <script src="${pdfjsUri}"></script>
    <script nonce="${nonce}">
        pdfjsLib.GlobalWorkerOptions.workerSrc = '${workerUri}';
        let pdfDoc = null, scale = 1.2;
        const pdfData = Uint8Array.from(atob('${pdfBase64}'), c => c.charCodeAt(0));
        
        async function renderAllPages() {
            const container = document.getElementById('container');
            container.innerHTML = '';
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.className = 'page-canvas';
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                container.appendChild(canvas);
            }
        }
        
        pdfjsLib.getDocument({data: pdfData}).promise.then(pdf => { pdfDoc = pdf; renderAllPages(); });
        
        document.getElementById('zoomIn').onclick = () => { scale += 0.2; renderAllPages(); };
        document.getElementById('zoomOut').onclick = () => { scale > 0.5 && (scale -= 0.2); renderAllPages(); };
        document.getElementById('fitWidth').onclick = () => {
            const width = document.getElementById('container').clientWidth - 40;
            pdfDoc.getPage(1).then(page => {
                scale = width / page.getViewport({ scale: 1 }).width;
                renderAllPages();
            });
        };
    </script>
</body>
</html>`;
        }
    }

    onDidDispose = (callback: () => void) => this.onDisposeCallback = callback;

    private createPanel = () => {
        this.panel = window.createWebviewPanel('latexPreview', 'LaTeX Preview', ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                Uri.file(this.extensionPath),
                Uri.file(join(this.extensionPath, 'node_modules', 'pdfjs-dist', 'build')),
                Uri.file(join(env.appRoot, '..'))
            ]
        });
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private dispose = () => {
        this.panel = undefined;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.onDisposeCallback?.();
    }

    private getNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        for (let i = 0; i < 16; i++) nonce += chars.charAt(Math.floor(Math.random() * chars.length));
        return nonce;
    }
}
