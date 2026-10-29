// Publish explicit source and build snapshots without touching a working-tree index.
import {execFileSync} from 'node:child_process';
import {mkdtemp,readdir,readFile,lstat,rm,writeFile} from 'node:fs/promises';
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
const git=(args,input)=>execFileSync('git',['--git-dir',directory,...args],{input,encoding:Buffer.isBuffer(input)?undefined:'utf8',env,maxBuffer:30*1024*1024}).toString().trim();
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
      else if(stat.isFile())entries.push(`100644 blob ${git(['hash-object','-w','--stdin'],await readFile(full))}\t${name}`);
    }
    return git(['mktree'],entries.join('\n')+'\n');
  }
  const sourceNames=['.gitignore','README.md','LICENSE','package.json','package-lock.json','playwright.config.js','index.html','manifest.webmanifest','sw.js','app','assets','scripts','tests','docs'];
  const sourceTree=await tree(resolve('.'),sourceNames);
  const siteTree=await tree(resolve('dist'));
  const sourceCommit=git(['commit-tree',sourceTree,...(parent.main?['-p',parent.main]:[]),'-m',values.message]);
  const siteCommit=git(['commit-tree',siteTree,...(parent['gh-pages']?['-p',parent['gh-pages']]:[]),'-m',`deploy: ${sourceCommit.slice(0,12)}`]);
  git(['push','--atomic',remote,`${sourceCommit}:refs/heads/main`,`${siteCommit}:refs/heads/gh-pages`]);
  const result={repository:`https://github.com/${values.repository}`,sourceCommit,siteCommit,expectedUrl:`https://${owner}.github.io/${values.repository.split('/')[1]}/`};
  await writeFile('/private/tmp/abc-garden-publish-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{await rm(directory,{recursive:true,force:true});}
