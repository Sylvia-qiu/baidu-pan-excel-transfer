/* Baidu web API adapter. Requests remain in the user's authenticated pan.baidu.com tab. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.PanExcel);if(typeof module==='object'&&module.exports)module.exports=api;else root.PanExcelAPI=api;})(globalThis,function(C){
 'use strict';
 function parseJSON(text){return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"|(-?\d{16,})(?=\s*[,}\]])/g,(full,num)=>num&&!Number.isSafeInteger(Number(num))?'"'+num+'"':full));}
 function extractData(text){
   const match=/locals\.mset\s*\(\s*\{/.exec(text);if(!match)throw Error('无法读取分享页信息：请检查链接、提取码或登录状态');
   const start=match.index+match[0].lastIndexOf('{');let depth=0,inString=false,escape=false;
   for(let i=start;i<text.length;i++){const c=text[i];if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;}else{if(c==='"')inString=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return parseJSON(text.slice(start,i+1));}}
   throw Error('分享页数据不完整');
 }
 function numericList(ids){if(!ids.length||ids.some(x=>!/^\d+$/.test(String(x))))throw Error('文件标识无效');return '['+ids.join(',')+']';}
 function item(raw){
   if(raw.fs_id===undefined||!raw.server_filename)throw Error('文件列表字段不完整');
   const name=String(raw.server_filename);if(name.includes('/')||name==='.'||name==='..')throw Error('异常文件名');
   const dir=Number(raw.isdir)===1;
   return {id:String(raw.fs_id),name,dir,size:dir?0:Number(raw.size),md5:dir?'':String(raw.md5||''),path:String(raw.path||'')};
 }
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 class BaiduAPI{
   constructor(fetcher=globalThis.fetch.bind(globalThis),delay=pause){this.fetcher=fetcher;this.delay=delay;this.token='';this.share=null;this.shareAuth={};this.onTrace=()=>{};}
   async request(path,query={},body=null,asText=false){
     const labels={'/api/gettemplatevariable':'读取登录状态','/api/user/getinfo':'读取当前账号','/share/verify':'验证原分享提取码','/share/list':'读取原分享文件列表','/api/list':'检查目标目录','/api/create':'创建目标目录','/share/transfer':'转存文件','/share/set':'创建新分享','/share/record':'核验新分享','/share/cancel':'取消不符要求的新分享'};
     const label=labels[path]||(path.startsWith('/s/')?'读取原分享页面':'读取百度接口');
     const detail=(query.dir||body?.path)?'，路径：'+(query.dir||body.path):(query.page?'，第'+query.page+'页':'');
     this.onTrace(label+detail);
     await this.delay(450);
     const q=new URLSearchParams({channel:'chunlei',web:'1',clienttype:'0',app_id:'250528',...query});if(this.token)q.set('bdstoken',this.token);
     // Current Baidu web client propagates verify.randsk as decoded sekey.
     // Scope it to source read/transfer calls; never attach it to own-drive APIs.
     if(['/share/list','/share/transfer'].includes(path))for(const [key,value] of Object.entries(this.shareAuth))q.set(key,value);
     const opt={credentials:'include',method:body===null?'GET':'POST',headers:{'X-Requested-With':'XMLHttpRequest'}};
     if(body!==null){opt.headers['Content-Type']='application/x-www-form-urlencoded;charset=UTF-8';opt.body=new URLSearchParams(body).toString();}
     const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),60000);opt.signal=abort.signal;
     try{
       const response=await this.fetcher(path+'?'+q.toString(),opt);
       if(!response.ok)throw Object.assign(Error('百度请求失败 HTTP '+response.status),{httpStatus:response.status});
       const text=await response.text();if(asText)return text;
       let result;try{result=parseJSON(text);}catch{throw Error('百度返回了非 JSON 页面，可能需要重新登录或验证码');}
       if(Number(result.errno)!==0){const code=Number(result.errno);const messages={'-6':'登录已失效，请刷新网盘页面','12':'触发转存数量限制','-9':'目录或文件不存在','2':'参数不被百度接受','115':'需要验证码','-62':'需要验证码','111':'请求过于频繁'};
         throw Object.assign(Error(messages[code]||result.show_msg||result.err_msg||('百度错误码 '+result.errno)),{errno:code,logid:result.request_id||result.logid,definite:true,fatal:[-6,115,-62,111].includes(code)});
       }
       return result;
     }catch(e){e.endpoint=path.startsWith('/s/')?'/s/…':path;e.method=opt.method;e.requestPath=query.dir||body?.path;e.page=query.page;e.message=label+'失败 ['+e.endpoint+(e.errno!==undefined?'，errno='+e.errno:'')+detail+']：'+e.message;throw e;}
     finally{clearTimeout(timer);}
   }
   async identity(){
     const result=await this.request('/api/gettemplatevariable',{fields:'["bdstoken","uk"]'});
     this.token=result.result?.bdstoken||'';let uk=result.result?.uk;
     if(!uk){const info=await this.request('/api/user/getinfo',{need_selfinfo:'1'});uk=info.user_info?.uk||info.records?.[0]?.uk;}
     if(!this.token||!uk)throw Object.assign(Error('请先登录百度网盘，再开始处理'),{fatal:true});
     return {uk:String(uk)};
   }
   async diagnose(task,log=()=>{}){
     let ok=true;log('诊断开始：不会创建目录、转存文件或生成分享');
     try{await this.identity();log('当前网盘登录状态正常');}catch(e){log(e.message);return {ok:false};}
     try{const items=await this.source(task.source);log('原分享读取成功：顶层 '+items.length+' 项');}catch(e){ok=false;log(e.message);}
     let path='';
     for(const part of task.target.split('/').filter(Boolean)){
       path+='/'+part;
       try{await this.request('/api/list',{dir:path,page:1,num:1});log('目录已存在：'+path);}
       catch(e){if(e.errno===-9){log('目录尚未创建（正常，正式转存时自动创建）：'+path);break;}ok=false;log(e.message);break;}
     }
     log('诊断结束，未写入任何网盘文件');return {ok};
   }
   async pages(path,query={},num=100,onPage=()=>{}){
     const out=[],seen=new Set();
     for(let page=1;;page++){
       const data=await this.request(path,{...query,page,num});
       onPage(data);
       if(!Array.isArray(data.list))throw Error('百度未返回完整文件列表');
       for(const raw of data.list){const obj=item(raw);if(seen.has(obj.id))throw Error('百度分页重复，已停止以避免遗漏文件');seen.add(obj.id);out.push(obj);}
       if(data.list.length<num&&Number(data.has_more||0)!==1)break;
       if(!data.list.length)throw Error('分页状态异常');
     }
     return out.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:a.id.localeCompare(b.id));
   }
   async list(path){return this.pages('/api/list',{dir:path,order:'name',desc:0,showempty:0});}
   async mkdir(path){
     let current='';for(const part of path.split('/').filter(Boolean)){
       current+='/'+part;
       try{await this.request('/api/list',{dir:current,page:1,num:1});}
       catch(e){if(e.errno!==-9)throw e;
         try{await this.request('/api/create',{a:'commit'},{path:current,isdir:1,block_list:'[]'});}catch(createError){if(createError.errno!==-8)throw createError;}
         await this.request('/api/list',{dir:current,page:1,num:1});
       }
     }
   }
   async source(source){
     this.share=null;this.shareAuth={};
     this.onTrace('原分享输入：'+(source.pwd?'已识别4位提取码':'未识别提取码（若原分享需要提取码，请检查原表）'));
     if(source.pwd){
       const verified=await this.request('/share/verify',{surl:source.key},{pwd:source.pwd,vcode:'',vcode_str:''});
       if(verified.randsk){
         let sekey;try{sekey=decodeURIComponent(String(verified.randsk));}catch{throw Error('百度返回的分享访问凭据编码异常');}
         this.shareAuth={sekey,is_from_web:true};
         this.onTrace('提取码验证成功，已取得本条分享访问凭据（不记录凭据内容）');
       }else this.onTrace('提取码验证成功，但未返回分享访问凭据；继续检查分享页面');
     }
     const page=await this.request('/s/1'+source.key,{},null,true);
     let data;
     try{data=extractData(page);}catch(e){
       // The current share frontend has no locals.mset bootstrap. Its list API
       // returns share_id and uk together with the actual file list.
       if(!e.message.startsWith('无法读取分享页信息'))throw e;
       data={};this.onTrace('分享页未包含旧版初始化结构，改用文件列表接口读取分享信息');
     }
     this.onTrace('原分享页面状态：errno='+(data.errno??'未提供')+'，errortype='+(data.errortype??'未提供'));
     if(data.errno!==undefined&&Number(data.errno)!==0)throw Error('原分享页面返回错误：errno='+data.errno+'，errortype='+(data.errortype??'未提供'));
     if(data.shareid&&data.share_uk)this.share={shareid:String(data.shareid),uk:String(data.share_uk)};
     // The upstream userscript reads file_list from the share page itself.
     // Some shares expose this list while rejecting the separate root API.
     const embedded=data.file_list;
     const raws=Array.isArray(embedded)?embedded:embedded?.list;
     const more=[data.has_more,embedded?.has_more,embedded?.hasMore].some(x=>x===true||Number(x)===1);
     const total=Array.isArray(embedded)?undefined:embedded?.total;
     const knownTotal=total!==undefined&&total!==null&&Number.isInteger(Number(total))&&Number(total)>=0;
     // 100 is our conservative page-size boundary, not a claimed Baidu limit.
     // Larger/unconfirmed or explicitly partial lists must be enumerated fully.
     if(this.share&&Array.isArray(raws)&&raws.length&&!more&&(!knownTotal||Number(total)===raws.length)&&(raws.length<100||knownTotal)){
       const items=raws.map(item);
       if(new Set(items.map(x=>x.id)).size!==items.length)throw Error('分享页文件标识重复，已停止以避免错误转存');
       this.onTrace('已从原分享页面读取顶层 '+items.length+' 项');
       return items.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:a.id.localeCompare(b.id));
     }
     const diagnostic='分享访问凭据：'+(this.shareAuth.sekey?'已取得':'未取得')+'；页面errno：'+(data.errno??'未提供')+'；页面errortype：'+(data.errortype??'未提供')+'；分享页清单类型：'+(Array.isArray(embedded)?'数组':embedded===undefined?'未返回':embedded===null?'null':typeof embedded)+'；已读取项数：'+(Array.isArray(raws)?raws.length:'未识别')+'；还有下一页：'+more+'；页面总数：'+(knownTotal?Number(total):'未提供')+'；页面字段名：'+Object.keys(data).join(',');
     this.onTrace('分享页面清单缺失或可能不完整，尝试分页读取。'+diagnostic);
     let items;
     try{items=await this.pages('/share/list',{shorturl:source.key,root:1,web:5,order:'name',desc:0,showempty:0},100,result=>{
       const shareid=result.share_id??result.shareid,uk=result.uk??result.share_uk;
       if(shareid&&uk){
         const info={shareid:String(shareid),uk:String(uk)};
         if(this.share&&(this.share.shareid!==info.shareid||this.share.uk!==info.uk))throw Error('分享身份信息不一致，已停止读取');
         this.share=info;
       }
     });}
     catch(e){e.sourceDiagnostic=diagnostic;throw e;}
     if(knownTotal&&items.length!==Number(total))throw Error('原分享文件数量与页面不一致，未开始转存');
     if(Array.isArray(raws)&&raws.some(raw=>!items.some(x=>x.id===String(raw.fs_id))))throw Error('分页结果缺少分享页中的文件，未开始转存');
     if(!this.share)throw Error('文件列表未返回分享 ID 或分享者 ID，未开始转存');
     this.onTrace('原分享读取成功：顶层 '+items.length+' 项');
     return items;
   }
   async transfer(items,path){
     if(!this.share)throw Error('尚未载入原分享');
     try{
       const result=await this.request('/share/transfer',{shareid:this.share.shareid,from:this.share.uk,ondup:'newcopy',async:0},{fsidlist:numericList(items.map(x=>x.id)),path});
       if(result.taskid&&!result.extra?.list)throw Error('百度返回异步任务，需人工核实转存结果');
       return result;
     }catch(e){
       // A failing transfer may be partially committed. Never blindly repeat a mutation.
       e.definite=false;throw e;
     }
   }
   async verifyTree(sources,destinations,source,reusedIds=[]){
     // Restore the source cookie and verify its root has not changed before sharing.
     const roots=await this.source(source);
     const changes=C.sourceChanges(sources,roots);
     if(changes.length)throw Error('原分享核验不一致：'+changes.slice(0,10).join('；'));
     const walk=async(src,dst,strict)=>{
       if(!src.dir){if(strict&&(!src.md5||!dst.md5||src.md5!==dst.md5))throw Error('同名文件内容校验未通过：'+src.name);return;}
       if(!src.path||!dst.path)throw Error('无法核实文件夹内部内容');
       const original=await this.pages('/share/list',{...this.share,root:0,dir:src.path,order:'name',desc:0,showempty:0});
       const copied=await this.list(dst.path);
       if(original.length!==copied.length)throw Error('文件夹内容数量不一致：'+src.name);
       for(const s of original){const d=copied.find(x=>x.name===s.name);if(!d||s.dir!==d.dir||(!s.dir&&(s.size!==d.size||(s.md5&&d.md5&&s.md5!==d.md5))))throw Error('文件夹内容不一致：'+s.name);await walk(s,d,strict);}
     };
     for(let i=0;i<sources.length;i++)await walk(roots.find(x=>x.id===sources[i].id),destinations[i],reusedIds.includes(destinations[i].id));
   }
   async createShare(ids,pwd){
     try{return await this.request('/share/set',{}, {fid_list:numericList(ids),schannel:4,channel_list:'[]',period:365,pwd,eflag_disable:'true'});}
     catch(e){if(e.errno===2)e.yearUnsupported=true;throw e;}
   }
   async shareRecords(wanted){
     const records=[];
     for(let page=1;;page++){
       const data=await this.request('/share/record',{page,num:100,order:'ctime',desc:1});
       if(!Array.isArray(data.list))throw Error('无法读取分享记录');
       if(data.list.some(r=>records.some(old=>String(old.shareId??old.shareid)===String(r.shareId??r.shareid))))throw Error('分享记录分页重复');
       records.push(...data.list);
       if(data.list.some(r=>String(r.shareId??r.shareid)===String(wanted))||data.list.length<100)break;
     }
     return records;
   }
   async cancelShare(id){return this.request('/share/cancel',{}, {shareid_list:numericList([id])});}
 }
 return {BaiduAPI,parseJSON,extractData};
});
