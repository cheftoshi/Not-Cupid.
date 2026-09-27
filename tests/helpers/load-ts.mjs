import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';

// Execute production TypeScript with explicit dependency seams, without network access.
export async function loadTs(path, mocks) {
  const key=`test-module-${randomUUID()}`;
  globalThis[key]=mocks;
  let code=ts.transpileModule(readFileSync(new URL('../../'+path,import.meta.url),'utf8'), {
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  }).outputText;
  code=code.replace(/import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];/g,(_,names,name)=>{
    if(!(name in mocks)) throw Error(`Missing mock: ${name}`);
    return `const {${names.replace(/\s+as\s+/g,':')}}=globalThis[${JSON.stringify(key)}][${JSON.stringify(name)}];`;
  }).replace(/import ["']server-only["'];/g,'');
  try {return await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
  finally {delete globalThis[key];}
}

export const nextMock={NextResponse:{json:(body,init)=>Response.json(body,init)}};
