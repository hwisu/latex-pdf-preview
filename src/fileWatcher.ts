import { Disposable, Uri, workspace } from 'vscode';
import { debounce } from './utils/debounce';

export class FileWatcher {
  private disposables: Disposable[] = [];
  private lastTrigger = 0;
  private readonly THROTTLE_MS = 2000;

  constructor(uri: Uri, onChange: () => void) {
    const debouncedChange = debounce(() => {
      const now = Date.now();
      if (now - this.lastTrigger < this.THROTTLE_MS) return;
      this.lastTrigger = now;
      onChange();
    }, 300);

    this.disposables.push(
      workspace.onDidSaveTextDocument(doc =>
        doc.uri.toString() === uri.toString() && debouncedChange()
      )
    );
  }

  dispose = () => this.disposables.forEach(d => d.dispose());
}
