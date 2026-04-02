import * as assert from 'assert';

suite('Debounce Unit Tests', () => {
  function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
  ): T {
    let timeout: ReturnType<typeof setTimeout>;
    return ((...args: unknown[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T;
  }

  test('should delay function execution', (done) => {
    let callCount = 0;
    const debouncedFn = debounce(() => {
      callCount++;
    }, 50);

    debouncedFn();

    assert.strictEqual(callCount, 0, 'Function should not be called immediately');

    setTimeout(() => {
      assert.strictEqual(callCount, 1, 'Function should be called after delay');
      done();
    }, 100);
  });

  test('should only call once for multiple rapid invocations', (done) => {
    let callCount = 0;
    const debouncedFn = debounce(() => {
      callCount++;
    }, 50);

    debouncedFn();
    debouncedFn();
    debouncedFn();
    debouncedFn();
    debouncedFn();

    setTimeout(() => {
      assert.strictEqual(
        callCount,
        1,
        'Function should only be called once for rapid invocations'
      );
      done();
    }, 100);
  });

  test('should call multiple times if invocations are spaced out', (done) => {
    let callCount = 0;
    const debouncedFn = debounce(() => {
      callCount++;
    }, 20);

    debouncedFn();

    setTimeout(() => {
      debouncedFn();
    }, 50);

    setTimeout(() => {
      assert.strictEqual(
        callCount,
        2,
        'Function should be called twice for spaced invocations'
      );
      done();
    }, 150);
  });

  test('should pass arguments to debounced function', (done) => {
    let receivedArgs: unknown[] = [];
    const debouncedFn = debounce((...args: unknown[]) => {
      receivedArgs = args;
    }, 50);

    debouncedFn('a', 'b', 'c');

    setTimeout(() => {
      assert.deepStrictEqual(receivedArgs, ['a', 'b', 'c']);
      done();
    }, 100);
  });

  test('should use latest arguments when debounced', (done) => {
    let receivedValue: unknown;
    const debouncedFn = debounce((value: unknown) => {
      receivedValue = value;
    }, 50);

    debouncedFn('first');
    debouncedFn('second');
    debouncedFn('third');

    setTimeout(() => {
      assert.strictEqual(
        receivedValue,
        'third',
        'Should use the latest arguments'
      );
      done();
    }, 100);
  });
});
