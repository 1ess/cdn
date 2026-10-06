import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const script=new URL('./build-pages.mjs',import.meta.url).pathname;
async function setup(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cdn-stage-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 async function put(p,s){await fs.mkdir(path.dirname(path.join(root,p)),{recursive:true});await fs.writeFile(path.join(root,p),s);}
 await put('contentImg/a.jpg','original');await put('font/blog.css','url("https://cdn.jsdelivr.net/gh/1ess/cdn/font/blog.woff2")');await put('font/blog.woff2','font');
 return {root,put,run:()=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'})};
}
test('copies static paths, applies deployment override, and preserves originals',async(t)=>{
 const {root,put,run}=await setup(t);await put('.pages-assets/contentImg/a.jpg','optimized');
 const r=run();assert.equal(r.status,0,r.stderr);assert.equal(await fs.readFile(path.join(root,'pages-dist/contentImg/a.jpg'),'utf8'),'optimized');assert.equal(await fs.readFile(path.join(root,'contentImg/a.jpg'),'utf8'),'original');
});
test('does not publish helper, version-control, or source override files',async(t)=>{
 const {root,put,run}=await setup(t);for(const p of ['README.md','Convert-ImagesToWebP.ps1','.git/config','tools/test.mjs','.pages-assets/unused.jpg'])await put(p,'private helper');
 const r=run();assert.equal(r.status,0,r.stderr);for(const p of ['README.md','Convert-ImagesToWebP.ps1','.git','tools','.pages-assets'])await assert.rejects(fs.access(path.join(root,'pages-dist',p)));
});
test('uses relative font URL, public CORS, and a real 404 document',async(t)=>{
 const {root,run}=await setup(t);const r=run();assert.equal(r.status,0,r.stderr);
 assert.match(await fs.readFile(path.join(root,'pages-dist/font/blog.css'),'utf8'),/url\("\.\/blog\.woff2"\)/);
 assert.match(await fs.readFile(path.join(root,'pages-dist/_headers'),'utf8'),/Access-Control-Allow-Origin: \*/);
 assert.match(await fs.readFile(path.join(root,'pages-dist/404.html'),'utf8'),/404/);
});
test('retains the two reviewed SQL tutorial downloads without publishing arbitrary archives',async(t)=>{
 const {root,put,run}=await setup(t);await put('contentImg/sql/create-databases.sql','example SQL');await put('contentImg/sql/index-simple.zip','example ZIP');await put('contentImg/private.zip','not reviewed');
 const r=run();assert.equal(r.status,0,r.stderr);await fs.access(path.join(root,'pages-dist/contentImg/sql/create-databases.sql'));await fs.access(path.join(root,'pages-dist/contentImg/sql/index-simple.zip'));await assert.rejects(fs.access(path.join(root,'pages-dist/contentImg/private.zip')));
});
test('fails before staging when a deployment asset exceeds the safety cap',async(t)=>{
 const {root,put,run}=await setup(t);await put('contentImg/large.mp4',Buffer.alloc(25*1024*1024+1));const r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/25 MiB/);await assert.rejects(fs.access(path.join(root,'pages-dist')));
});
test('rejects a source symlink rather than exposing its target',async(t)=>{
 const {root,run}=await setup(t);await fs.symlink('/etc/passwd',path.join(root,'contentImg/leak.jpg'));const r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/symlink/i);
});
test('rejects a symlinked override directory',async(t)=>{
 const {root,put,run}=await setup(t);await put('outside/a.jpg','outside data');await fs.mkdir(path.join(root,'.pages-assets'),{recursive:true});await fs.symlink(path.join(root,'outside'),path.join(root,'.pages-assets/contentImg'));
 const r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/symlink|outside/i);
});

test('preserves original assets below the platform limit without unnecessary recompression',async(t)=>{
 const {root,put,run}=await setup(t);await put('contentImg/already-valid.mp4',Buffer.alloc(24.5*1024*1024));const r=run();assert.equal(r.status,0,r.stderr);
});
test('requires optimized overrides to keep the 24 MiB safety margin',async(t)=>{
 const {root,put,run}=await setup(t);await put('.pages-assets/contentImg/a.jpg',Buffer.alloc(24*1024*1024+1));const r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/24 MiB/);
});
