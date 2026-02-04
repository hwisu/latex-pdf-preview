import * as assert from 'assert';
import { basename } from 'path';

suite('Compiler Unit Tests', () => {
  suite('Executable Validation', () => {
    const ALLOWED_EXECUTABLES = ['pdflatex', 'xelatex', 'lualatex', 'latexmk'];

    function validateExecutablePath(exePath: string): string {
      const exeName = basename(exePath).replace(/\.exe$/i, '');

      if (!ALLOWED_EXECUTABLES.includes(exeName)) {
        throw new Error(`Invalid LaTeX executable: ${exeName}`);
      }

      if (exePath.includes('..') || /[;&|`$]/.test(exePath)) {
        throw new Error('Invalid characters in executable path');
      }

      return exePath;
    }

    test('should accept pdflatex', () => {
      assert.strictEqual(validateExecutablePath('pdflatex'), 'pdflatex');
    });

    test('should accept xelatex', () => {
      assert.strictEqual(validateExecutablePath('xelatex'), 'xelatex');
    });

    test('should accept lualatex', () => {
      assert.strictEqual(validateExecutablePath('lualatex'), 'lualatex');
    });

    test('should accept latexmk', () => {
      assert.strictEqual(validateExecutablePath('latexmk'), 'latexmk');
    });

    test('should accept full path to pdflatex', () => {
      assert.strictEqual(
        validateExecutablePath('/usr/bin/pdflatex'),
        '/usr/bin/pdflatex'
      );
    });

    test('should accept Windows path with .exe', () => {
      assert.strictEqual(
        validateExecutablePath('C:\\texlive\\bin\\pdflatex.exe'),
        'C:\\texlive\\bin\\pdflatex.exe'
      );
    });

    test('should reject invalid executable', () => {
      assert.throws(() => validateExecutablePath('bash'), /Invalid LaTeX executable/);
    });

    test('should reject command injection with semicolon', () => {
      assert.throws(
        () => validateExecutablePath('pdflatex; echo hacked'),
        /Invalid characters/
      );
    });

    test('should reject command injection with pipe', () => {
      assert.throws(
        () => validateExecutablePath('pdflatex | cat /etc/passwd'),
        /Invalid characters/
      );
    });

    test('should reject command injection with ampersand', () => {
      assert.throws(
        () => validateExecutablePath('pdflatex && rm -rf /'),
        /Invalid characters/
      );
    });

    test('should reject path traversal', () => {
      assert.throws(
        () => validateExecutablePath('../../../bin/bash'),
        /Invalid characters/
      );
    });

    test('should reject backtick injection', () => {
      assert.throws(
        () => validateExecutablePath('pdflatex`whoami`'),
        /Invalid characters/
      );
    });

    test('should reject dollar sign injection', () => {
      assert.throws(
        () => validateExecutablePath('pdflatex$(whoami)'),
        /Invalid characters/
      );
    });
  });
});
