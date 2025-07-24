import { Disposable, Uri, workspace } from 'vscode';
import { debounce } from './utils/debounce';

export class FileWatcher {
    private disposables: Disposable[] = [];

    constructor(uri: Uri, onChange: () => void) {
        const debouncedChange = debounce(onChange, 1000);
        this.disposables.push(
            workspace.onDidSaveTextDocument(doc => 
                doc.uri.toString() === uri.toString() && debouncedChange()
            )
        );
    }

    dispose = () => this.disposables.forEach(d => d.dispose());
}