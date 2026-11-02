// Push the existing source commit and a fresh site snapshot atomically.
import {execFileSync,spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {snapshotTree} from './publish-tree.mjs';
import {join,resolve} from 'node:path';
import {parseArgs} from 'node:util';

const {values}=parseArgs({options:{repository:{type:'string'},message:{type:'string'}}});
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(values.repository||''))throw new Error('Usage: node scripts/publish.mjs --repository owner/name');
const [owner]=values.repository.split('/');
const remote=`git@github.com:${values.repository}.git`;
const localGit=(args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(localGit(['status','--porcelain']))throw new Error('Commit or resolve all changes before publishing.');
if(localGit(['branch','--show-current'])!=='main')throw new Error('Publish from main only.');
const sourceCommit=localGit(['rev-parse','HEAD']);
const directory=await mkdtemp(join(tmpdir(),'abc-garden-publish-'));
const authorName=execFileSync('git',['config','--global','--get','user.name'],{encoding:'utf8'}).trim()||owner;
// Respect an explicit SSH transport override (for example, an alternate GitHub endpoint).
const env={...process.env,GIT_ALTERNATE_OBJECT_DIRECTORIES:[localGit(['rev-parse','--path-format=absolute','--git-path','objects']),process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES].filter(Boolean).join(':'),GIT_INDEX_FILE:join(directory,'index'),GIT_AUTHOR_NAME:authorName,GIT_COMMITTER_NAME:authorName,GIT_AUTHOR_EMAIL:`${owner}@users.noreply.github.com`,GIT_COMMITTER_EMAIL:`${owner}@users.noreply.github.com`,GIT_SSH_COMMAND:process.env.GIT_SSH_COMMAND||'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes'};
const git=(args,input)=>{
  const attempts=['fetch','ls-remote'].includes(args[0])?3:1;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return execFileSync('git',['--git-dir',directory,...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',env,maxBuffer:30*1024*1024,timeout:120000,stdio:['pipe','pipe','pipe']}).toString().trim();}
    catch(error){if(attempt===attempts)throw error;console.log(`Retrying ${args[0]} after connection failure (${attempt}/${attempts})`);}
  }
};
try{
  execFileSync('git',['init','--bare','--quiet',directory],{env});
  const refs=git(['ls-remote','--heads',remote]);
  const parent={};
  for(const branch of ['main','gh-pages']){
    const match=refs.split('\n').find(line=>line.endsWith(`\trefs/heads/${branch}`));
    if(match){git(['fetch','--quiet',remote,`refs/heads/${branch}:refs/heads/${branch}`]);parent[branch]=git(['rev-parse',`refs/heads/${branch}`]);}
  }
  git(['fetch','--quiet',resolve('.'),`${sourceCommit}:refs/heads/source`]);
  if(parent.main)git(['merge-base','--is-ancestor',parent.main,sourceCommit]);
  // Build only after checking ancestry; never deploy a stale dist directory.
  execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
  if(localGit(['status','--porcelain'])||localGit(['rev-parse','HEAD'])!==sourceCommit)throw new Error('Source changed during build; commit and retry.');
  const siteTree=await snapshotTree(resolve('dist'),git);
  const siteCommit=git(['commit-tree',siteTree,...(parent['gh-pages']?['-p',parent['gh-pages']]:[]),'-m',values.message||`deploy: ${sourceCommit.slice(0,12)}`]);
  console.log('Committed source and fresh site snapshot prepared. Uploading changed source and site objects…');
  await new Promise((resolve,reject)=>{
    const child=spawn('git',['--git-dir',directory,'push','--progress','--atomic',remote,`${sourceCommit}:refs/heads/main`,`${siteCommit}:refs/heads/gh-pages`],{env,stdio:['ignore','inherit','inherit']});
    const timer=setTimeout(()=>child.kill('SIGTERM'),10*60000);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Push exited with ${code}; check remote refs before retrying.`));});
  });
  const result={repository:`https://github.com/${values.repository}`,sourceCommit,siteCommit,expectedUrl:`https://${owner}.github.io/${values.repository.split('/')[1]}/`};
  await writeFile('/private/tmp/abc-garden-publish-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{await rm(directory,{recursive:true,force:true});}
