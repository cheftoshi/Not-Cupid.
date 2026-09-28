import test from 'node:test';
import assert from 'node:assert/strict';
import * as jsxRuntime from 'react/jsx-runtime';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTs} from './helpers/load-ts.mjs';

test('rendered FAQ explains current billing, reporting, plans and city limitations',async()=>{
  const page=await loadTs('app/faq/page.tsx',{
    'react/jsx-runtime':jsxRuntime,
    'next/link':{default:props=>createElement('a',props)},
  });
  const html=renderToStaticMarkup(createElement(page.default));
  for(const copy of ['How do I cancel Pro?','Cancel renewal','Where do I chat after joining a plan?',
    '72 hours','Yes or Pass','24 hours','does not detect dishonesty',
    'A supported city does not guarantee','billing or storage cleanup fails']) assert.ok(html.includes(copy),copy);
  assert.ok(!html.includes('clocks when'));
  assert.ok(!html.includes('accepting any match brings you straight back'));
  assert.match(html,/href="\/how-it-works"/);
  assert.match(html,/href="\/quiz"/);
});
