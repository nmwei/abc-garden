// Publish explicit source and build snapshots without touching a working-tree index.
import {execFileSync,spawn} from 'node:child_process';
import {mkdtemp,readdir,lstat,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {parseArgs} from 'node:util';

const {values}=parseArgs({options:{repository:{type:'string'},message:{type:'string',default:'feat: 实现 iPad 字母小花园与自然语音练习'}}});
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(values.repository||''))throw new Error('Usage: node scripts/publish.mjs --repository owner/name');
const [owner]=values.repository.split('/');
const remote=`git@github.com:${values.repository}.git`;
const directory=await mkdtemp(join(tmpdir(),'abc-garden-publish-'));
const authorName=execFileSync('git',['config','--global','--get','user.name'],{encoding:'utf8'}).trim()||owner;
const env={...process.env,GIT_AUTHOR_NAME:authorName,GIT_COMMITTER_NAME:authorName,GIT_AUTHOR_EMAIL:`${owner}@users.noreply.github.com`,GIT_COMMITTER_EMAIL:`${owner}@users.noreply.github.com`,GIT_SSH_COMMAND:'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes'};
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
    if(match){git(['fetch','--quiet',remote,`refs/heads/${branch}:refs/heads/${branch}`]);parent[branch]=match.split('\t')[0];}
  }
  async function tree(path,names){
    const entries=[];
    for(const name of (names||await readdir(path)).sort()){
      const full=join(path,name),stat=await lstat(full);
      if(stat.isSymbolicLink())throw new Error(`Refuse symlink: ${full}`);
      if(stat.isDirectory())entries.push(`040000 tree ${await tree(full)}\t${name}`);
      else if(stat.isFile())entries.push(`100644 blob ${git(['hash-object','-w','--',full])}\t${name}`);
    }
    return git(['mktree'],entries.join('\n')+'\n');
  }
  const sourceNames=['.gitignore','README.md','LICENSE','package.json','package-lock.json','playwright.config.js','index.html','manifest.webmanifest','sw.js','app','assets','scripts','tests','docs'];
  const sourceTree=await tree(resolve('.'),sourceNames);
  const siteTree=await tree(resolve('dist'));
  const sourceCommit=git(['commit-tree',sourceTree,...(parent.main?['-p',parent.main]:[]),'-m',values.message]);
  const siteCommit=git(['commit-tree',siteTree,...(parent['gh-pages']?['-p',parent['gh-pages']]:[]),'-m',`deploy: ${sourceCommit.slice(0,12)}`]);
  console.log('Source and site snapshots prepared. Uploading audio and code…');
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
