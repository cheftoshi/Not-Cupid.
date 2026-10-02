import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement, useId, version } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('React runtime and DOM renderer are pinned and installed as a compatible pair', () => {
  assert.match(manifest.dependencies.react, /^19\.\d+\.\d+$/);
  assert.equal(manifest.dependencies.react, manifest.dependencies['react-dom']);
  assert.equal(version, manifest.dependencies.react);
  assert.equal(require('react-dom/package.json').version, version);
  for (const name of ['@types/react', '@types/react-dom']) {
    assert.match(manifest.devDependencies[name], /^19\.\d+\.\d+$/);
    assert.equal(require(`${name}/package.json`).version, manifest.devDependencies[name]);
  }
});

test('upgraded React renders labelled inputs with hooks using the installed DOM server', () => {
  function Example() {
    const id = useId();
    return createElement('div', null,
      createElement('label', { htmlFor: id }, 'Message'),
      createElement('input', { id, defaultValue: 'Hello' }),
    );
  }
  const html = renderToString(createElement(Example));
  const id = html.match(/<input id="([^"]+)"/)[1];
  assert.ok(html.includes(`for="${id}"`));
  assert.ok(html.includes('value="Hello"'));
});
