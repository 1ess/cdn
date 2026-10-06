import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const output=path.join(root,'pages-dist');
const overrides=path.join(root,'.pages-assets');
const maxBytes=25*1024*1024;
const overrideMaxBytes=24*1024*1024;
const extensions=new Set(['.jpg','.jpeg','.png','.webp','.gif','.svg','.ico','.mp4','.css','.woff2','.ttf']);
const tutorials=new Set(['contentImg/sql/create-databases.sql','contentImg/sql/index-simple.zip']);
const assetRoots=new Set(['_temp','blogImg','contentImg','font','h4cker','icons']);
const rootAssets=new Set(['0xfee1dead.jpg','0xfee1dead.webp']);
const files=[];

async function walk(directory,relative=''){
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const name=relative?`${relative}/${entry.name}`:entry.name;
  if(!relative&&!assetRoots.has(entry.name)&&!rootAssets.has(entry.name))continue;
  if(entry.isSymbolicLink())throw new Error(`Refusing symlink: ${name}`);
  if(entry.isDirectory()){await walk(path.join(directory,entry.name),name);continue;}
  if(!entry.isFile()||(!extensions.has(path.extname(name).toLowerCase())&&!tutorials.has(name)))continue;
  let source=path.join(root,name);
  try {
   const candidate=await fs.lstat(path.join(overrides,name));
   if(candidate.isSymbolicLink()||!candidate.isFile())throw new Error(`Invalid override: ${name}`);
   source=path.join(overrides,name);
   if(await fs.realpath(source)!==source)throw new Error(`Refusing symlink in override path: ${name}`);
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const info=await fs.stat(source);
  const limit=source.startsWith(overrides+path.sep)?overrideMaxBytes:maxBytes;
  if(info.size>limit)throw new Error(`Asset exceeds the ${limit/1024/1024} MiB safety cap: ${name} (${info.size} bytes)`);
  files.push({name,source,size:info.size});
 }
}

try{
 await walk(root);
 if(files.length+2>20000)throw new Error('Cloudflare Pages Free allows at most 20,000 files');
 const fonts=files.find(f=>f.name==='font/blog.css');
 if(!fonts)throw new Error('Missing font/blog.css');
 // Validation finishes before replacing any previous generated output.
 await fs.rm(output,{recursive:true,force:true});
 for(const file of files){
  const target=path.join(output,file.name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(file.source,target);
 }
 const fontFile=path.join(output,'font/blog.css');
 const css=await fs.readFile(fontFile,'utf8');
 await fs.writeFile(fontFile,css.replaceAll('https://cdn.jsdelivr.net/gh/1ess/cdn/font/blog.woff2','./blog.woff2'));
 await fs.writeFile(path.join(output,'_headers'),'/*\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n  Cache-Control: public, max-age=3600\n');
 await fs.writeFile(path.join(output,'404.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 · Asset not found</title><h1>404 · Asset not found</h1><p>The requested file does not exist.</p></html>\n');
 console.log(JSON.stringify({output,files:files.length+2,assetBytes:files.reduce((n,f)=>n+f.size,0),largestAssetBytes:Math.max(...files.map(f=>f.size)),overrides:files.filter(f=>f.source.startsWith(overrides+path.sep)).map(f=>f.name)},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
