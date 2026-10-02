import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import compiler from 'typescript-test-compiler';

const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('installed TypeScript CLI matches the pinned release and accepts project configuration', () => {
  assert.equal(require('typescript/package.json').version, manifest.devDependencies.typescript);
  const cli = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');
  const config = JSON.parse(execFileSync(process.execPath, [cli, '--showConfig'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
  }));
  assert.equal(config.compilerOptions.target, 'es2017');
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.noEmit, true);
  assert.equal(config.compilerOptions.downlevelIteration, undefined);
});

test('test-only compiler still executes TypeScript fixtures without production services', async () => {
  const { outputText } = compiler.transpileModule('export const value: number = 42;', {
    compilerOptions: { module: compiler.ModuleKind.ESNext, target: compiler.ScriptTarget.ES2022 },
  });
  const fixture = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  assert.equal(fixture.value, 42);
});
