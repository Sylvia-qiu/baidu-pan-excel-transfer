const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const A=fs.existsSync(__dirname+'/api.js')?require('./api.js'):{};
test('current share frontend without locals.mset gets files and share identity from list API',async()=>{
 const api=new A.BaiduAPI(async(url)=>{
  if(url.startsWith('/s/'))return new Response('<html><title>百度网盘-分享文件</title><div id="app"></div></html>');
  return new Response(JSON.stringify({errno:0,share_id:'123',uk:'456',list:Array.from({length:10},(_,i)=>({...pageFile,fs_id:i+1,server_filename:'第'+(i+1)+'集.mp4'}))}));
 },async()=>{});
 assert.equal((await api.source({key:'modern'})).length,10);
 assert.deepEqual(api.share,{shareid:'123',uk:'456'});
});
test('verified share credential is decoded once and used for root, nested list and transfer only',async()=>{
 const secret='private+/=';const calls=[];
 const api=new A.BaiduAPI(async(url,opt)=>{
  const u=new URL(url,'https://pan.baidu.com');calls.push(u);
  if(u.pathname==='/share/verify')return new Response(JSON.stringify({errno:0,randsk:encodeURIComponent(secret)}));
  if(u.pathname.startsWith('/s/'))return new Response('locals.mset({"shareid":123,"share_uk":456,"errno":0,"errortype":-1});');
  if(u.pathname==='/share/list'||u.pathname==='/share/transfer'){
   if(u.searchParams.get('sekey')!==secret||u.searchParams.get('is_from_web')!=='true')return new Response('{"errno":-9}');
   return new Response(JSON.stringify({errno:0,list:[pageFile]}));
  }
  return new Response('{"errno":0,"list":[]}');
 },async()=>{});
 const logs=[];api.onTrace=x=>logs.push(x);
 const files=await api.source({key:'protected',pwd:'abcd'});
 await api.transfer(files,'/target');await api.list('/target');
 await api.pages('/share/list',{...api.share,root:0,dir:'/src'});
 assert.ok(calls.filter(u=>u.pathname==='/share/list').every(u=>u.searchParams.get('sekey')===secret));
 assert.ok(calls.filter(u=>u.pathname==='/api/list').every(u=>!u.searchParams.has('sekey')));
 assert.ok(!logs.join('\n').includes(secret));
 await api.source({key:'public'}).catch(()=>{});
 assert.equal(api.shareAuth.sekey,undefined);
});
const pageFile={fs_id:11,server_filename:'01.mp4',path:'/src/01.mp4',isdir:0,size:100};
function pageAPI(fileList,extra={}){
 return new A.BaiduAPI(async(url)=>{
  const u=new URL(url,'https://pan.baidu.com');
  if(u.pathname.startsWith('/s/'))return new Response('locals.mset('+JSON.stringify({shareid:123,share_uk:456,file_list:fileList,...extra})+');');
  return new Response('{"errno":-9}');
 },async()=>{});
}
test('uses embedded root files when share/list is unavailable',async()=>{
 for(const list of [[pageFile],{list:[pageFile],total:1,has_more:0}]){
  const api=pageAPI(list);const items=await api.source({key:'originalKey'});
  assert.equal(items.length,1);assert.equal(items[0].id,'11');
 }
});
test('never accepts an explicitly partial or duplicate embedded list',async()=>{
 for(const list of [{list:[pageFile],total:2},{list:[pageFile],has_more:1},[pageFile,pageFile]]){
  await assert.rejects(pageAPI(list).source({key:'originalKey'}));
 }
 await assert.rejects(pageAPI([pageFile],{has_more:1}).source({key:'originalKey'}));
});
test('root share listing uses the original shorturl, not directory-only shareid/uk parameters',async()=>{
 const api=new A.BaiduAPI(async(url,opt)=>{
  const u=new URL(url,'https://pan.baidu.com');
  if(u.pathname==='/share/verify')return new Response('{"errno":0}');
  if(u.pathname==='/s/1originalKey')return new Response('locals.mset({"shareid":123,"share_uk":456});');
  if(u.pathname==='/share/list'){
   if(u.searchParams.get('shorturl')!=='originalKey'||u.searchParams.get('root')!=='1')return new Response('{"errno":-9}');
   return new Response('{"errno":0,"list":[{"fs_id":11,"server_filename":"01.mp4","path":"/src/01.mp4","isdir":0,"size":100}]}');
  }
  assert.fail('unexpected request');
 },async()=>{});
 const items=await api.source({key:'originalKey',pwd:'abcd'});
 assert.equal(items.length,1);assert.equal(items[0].name,'01.mp4');
 assert.deepEqual(api.share,{shareid:'123',uk:'456'});
});
test('missing share errors identify source endpoint without exposing password or token',async()=>{
 const api=new A.BaiduAPI(async()=>new Response('{"errno":-9}'),async()=>{});api.token='SECRET-TOKEN';
 await assert.rejects(api.request('/share/list',{root:1,page:1,pwd:'SECRET-PWD'}),e=>{
  assert.equal(e.errno,-9);assert.match(e.message,/原分享/);assert.match(e.message,/share\/list/);assert.match(e.message,/errno=-9/);assert.ok(!e.message.includes('SECRET'));return true;
 });
});
test('fallback failure includes safe page shape evidence',async()=>{
 await assert.rejects(pageAPI(undefined).source({key:'originalKey'}),e=>{
  assert.equal(e.endpoint,'/share/list');assert.equal(e.method,'GET');assert.equal(e.page,1);
  assert.match(e.sourceDiagnostic,/未返回/);assert.match(e.sourceDiagnostic,/shareid/);return true;
 });
});
test('diagnosis reports source failure and expected missing folder without any file writes',async()=>{
 assert.equal(typeof A.BaiduAPI.prototype.diagnose,'function');
 const api=new A.BaiduAPI(async()=>{},async()=>{});const logs=[];
 api.identity=async()=>({uk:'1'});api.source=async()=>{throw Error('SOURCE_FAILED');};
 api.request=async(path,query,body)=>{assert.equal(path,'/api/list');assert.equal(body,undefined);throw Object.assign(Error('missing'),{errno:-9});};
 api.mkdir=api.transfer=api.createShare=async()=>assert.fail('diagnosis must never modify files or create shares');
 const result=await api.diagnose({source:{key:'abc'},target:'/missing/child'},x=>logs.push(x));
 assert.equal(result.ok,false);assert.ok(logs.some(x=>x.includes('SOURCE_FAILED')));assert.ok(logs.some(x=>x.includes('正常')));
});
test('large Baidu identifiers are preserved exactly, without changing strings',()=>{
 assert.equal(typeof A.parseJSON,'function');
 const parsed=A.parseJSON('{"shareid":1234567890123456789,"text":"1234567890123456789","fsIds":[9876543210987654321]}');
 assert.equal(parsed.shareid,'1234567890123456789');assert.equal(parsed.fsIds[0],'9876543210987654321');
});
test('source page parser handles braces and terminators inside quoted filenames',()=>{
 assert.equal(typeof A.extractData,'function');
 assert.equal(A.extractData('locals.mset( {"shareid":123,"share_uk":45,"title":"x }); y"});').title,'x }); y');
});
test('mkdir walks missing parent directories and confirms final directory',async()=>{
 assert.equal(typeof A.BaiduAPI,'function');const dirs=new Set(['/']);const requests=[];
 const api=new A.BaiduAPI(async(url,opt)=>{const u=new URL(url,'https://pan.baidu.com');const form=new URLSearchParams(opt.body);requests.push([u.pathname,form.get('path')]);
 if(u.pathname==='/api/list')return new Response(JSON.stringify(dirs.has(u.searchParams.get('dir'))?{errno:0,list:[]}:{errno:-9}));
 if(u.pathname==='/api/create'){dirs.add(form.get('path'));return new Response('{"errno":0}');} throw Error('unexpected');},async()=>{});
 await api.mkdir('/父/子/孙');assert.ok(dirs.has('/父/子/孙'));
 assert.deepEqual(requests.filter(x=>x[0]==='/api/create').map(x=>x[1]),['/父','/父/子','/父/子/孙']);
});
test('share request submits 365 days and transferred ids, never parent id',async()=>{
 assert.equal(typeof A.BaiduAPI,'function');let request;
 const api=new A.BaiduAPI(async(url,opt)=>{request={url,form:new URLSearchParams(opt.body)};return new Response('{"errno":0,"shareid":123,"link":"https://pan.baidu.com/s/1new"}');},async()=>{});
 await api.createShare(['1234567890123456789'],'abcd');
 assert.equal(request.form.get('period'),'365');assert.equal(request.form.get('fid_list'),'[1234567890123456789]');assert.equal(request.form.get('pwd'),'abcd');
});
test('paginated listings retain all items and reject repeated pages',async()=>{
 assert.equal(typeof A.BaiduAPI,'function');const api=new A.BaiduAPI(async()=>{},async()=>{});
 api.request=async(p,q)=>({errno:0,list:q.page===1?Array.from({length:100},(_,i)=>({fs_id:i+1,server_filename:'f'+i,isdir:0,size:1})):[{fs_id:101,server_filename:'last',isdir:0,size:1}]});
 assert.equal((await api.pages('/api/list',{},100)).length,101);
 api.request=async()=>({errno:0,list:Array.from({length:100},(_,i)=>({fs_id:i+1,server_filename:'f'+i,isdir:0,size:1}))});
 await assert.rejects(api.pages('/api/list',{},100));
});
