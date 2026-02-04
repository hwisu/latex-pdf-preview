import { Disposable, Uri, workspace } from 'vscode';
import { debounce } from './utils/debounce';

export class FileWatcher {
  private disposables: Disposable[] = [];
  private lastTrigger = 0;

  constructor(uri: Uri, onChange: () => void) {
    const config = workspace.getConfiguration('latex-preview');
    const debounceDelay = config.get<number>('debounceDelay', 300);
    const throttleDelay = config.get<number>('throttleDelay', 2000);

    const debouncedChange = debounce(() => {
      const now = Date.now();
      if (now - this.lastTrigger < throttleDelay) return;
      this.lastTrigger = now;
      onChange();
    }, debounceDelay);

    this.disposables.push(
      workspace.onDidSaveTextDocument(doc =>
        doc.uri.toString() === uri.toString() && debouncedChange()
      )
    );
  }

  dispose = () => this.disposables.forEach(d => d.dispose());
}
