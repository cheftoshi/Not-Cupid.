import test from 'node:test';
import assert from 'node:assert/strict';
import { appViewport } from '../lib/app-viewport.ts';
const base = {layoutWidth:382,layoutHeight:580,visualWidth:382,visualHeight:580,scale:1,editableFocus:false,wasEditing:false};
test('pinch zoom preserves layout and never hides navigation, even with field focus', () => {
 for (const editableFocus of [false,true]) assert.deepEqual(appViewport({...base,visualHeight:280,visualWidth:191,scale:2,editableFocus}), {height:580,width:382,editing:false});
});
test('keyboard needs editable focus and remains detected during dismissal until viewport recovers', () => {
 assert.equal(appViewport({...base,visualHeight:300}).editing,false);
 assert.equal(appViewport({...base,visualHeight:300,editableFocus:true}).editing,true);
 assert.equal(appViewport({...base,visualHeight:350,wasEditing:true}).editing,true);
 assert.equal(appViewport({...base,visualHeight:560,wasEditing:true}).editing,false);
 assert.equal(appViewport({...base,editableFocus:true}).editing,false);
});
test('rotation and window resizing use current dimensions; missing visual viewport falls back safely', () => {
 assert.deepEqual(appViewport({...base,layoutWidth:951,layoutHeight:585,visualWidth:951,visualHeight:585}),{width:951,height:585,editing:false});
 assert.deepEqual(appViewport({...base,visualWidth:undefined,visualHeight:undefined,scale:undefined}),{width:382,height:580,editing:false});
});
