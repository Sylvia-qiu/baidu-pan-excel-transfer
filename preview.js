/* Own-drive episode previews. No transfer, move, rename or directory sharing. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.PanExcel);if(typeof module==='object'&&module.exports)module.exports=api;else root.PanPreview=api;})(globalThis,function(C){
 'use strict';
 const video=/\.(mp4|mkv|mov|avi|flv|m4v|wmv|ts|webm)$/i;
 function episode(name){
   if(!video.test(name))return null;
   const stem=name.normalize('NFKC').replace(/(?:[. _-]*(?:mp4|mkv|mov|avi|flv|m4v|wmv|ts|webm))+$/i,'').trim();
   if(/\d\s*[-~至到]\s*\d|合集/.test(stem))return null;
   const explicit=[...stem.matchAll(/第\s*(\d{1,3})\s*集/g)];
   if(explicit.length)return explicit.length===1&&Number(explicit[0][1])>0?Number(explicit[0][1]):null;
   if(/\d\s*[-~至到]\s*\d|合集|预告|花絮|1080p|2160p|720p/i.test(stem))return null;
   let m=/^#(\d{1,3})(?!\d)/.exec(stem)||/^(?:EP?|Episode)\s*0*(\d{1,3})(?:[_ -]V\d+)?$/i.exec(stem)||/^(\d{1,3})(?:成片)?$/.exec(stem)||/^.*?[^\d](\d{1,3})$/.exec(stem);
   return m&&Number(m[1])>0?Number(m[1]):null;
 }
 function reviewSelection(row,choices){
   if(!choices.length||choices.length>10)throw Error('请选择 1–10 个文件');
   const ids=new Set(),episodes=new Set();
   return choices.map(c=>{
     const f=row.candidates?.find(f=>f.id===c.id),n=Number(c.episode);
     if(!f||f.dir||!video.test(f.name))throw Error('所选文件不在本次目录列表中');
     if(!Number.isInteger(n)||n<1||n>10)throw Error('集数必须在 1–10 之间');
     const known=episode(f.name);if(known!==null&&known!==n&&c.manualEpisode!==true)throw Error('集数与文件名不一致：'+f.name);
     if(ids.has(f.id)||episodes.has(n))throw Error('存在重复集数，请每集只选一个版本');
     ids.add(f.id);episodes.add(n);return {...f,episode:n,manualEpisode:known===null||c.manualEpisode===true};
   }).sort((a,b)=>a.episode-b.episode);
 }
 function pathValue(path){path=String(path||'').trim();if(!path.startsWith('/')||/[\x00-\x1f\\]/.test(path)||path.split('/').some(p=>p==='.'||p==='..'))throw Error('请输入有效的网盘完整目录，以 / 开头');return '/'+path.split('/').filter(Boolean).join('/');}
 const join=(p,n)=>(p==='/'?'':p)+'/'+n;
 function selection(items){
   const videos=items.filter(f=>!f.dir&&video.test(f.name));
   const unknown=videos.filter(f=>episode(f.name)===null&&!/预告|花絮|片头|片尾/.test(f.name));
   const files=videos.map(f=>({...f,episode:episode(f.name)})).filter(f=>f.episode>=1&&f.episode<=10).sort((a,b)=>a.episode-b.episode);
   let error=unknown.length?'无法确定集数：'+unknown.map(f=>f.name).join('、'):'';
   if(new Set(files.map(f=>f.episode)).size!==files.length)error='前 10 集有重复集数，请核对版本：'+files.map(f=>f.name).join('、');
   const missing=Array.from({length:10},(_,i)=>i+1).filter(n=>!files.some(f=>f.episode===n));
   return {videos,files,error,warning:files.length<10?'不足 10 集；未找到：'+missing.join('、')+'。仅分享已识别的第 1–10 集，不用后续集数补足。':''};
 }
 async function scan({root,list,stopped=()=>false,trace=()=>{}}){
   root=pathValue(root);const seen=new Set();
   async function walk(path,name){
     if(stopped())throw Object.assign(Error('扫描已暂停，请重新扫描'),{paused:true});
     if(seen.has(path))throw Error('发现重复目录，停止扫描：'+path);seen.add(path);trace('扫描：'+path);
     let items;try{items=await list(path);}catch(e){return [{name,path,files:[],error:'目录读取未完成：'+e.message}];}
     const chosen=selection(items);
     if(chosen.files.length||chosen.videos.length){return [{name,path,candidates:chosen.videos,readCount:items.length,files:chosen.files,error:chosen.error||(!chosen.files.length?'未找到第 1–10 集视频':''),warning:chosen.warning}];}
     const rows=[];
     for(const d of items.filter(f=>f.dir)){
       if(/^(封面|字幕|中文srt|英文srt|海报)$/i.test(d.name))continue;
       const child=join(path,d.name);if(d.path&&d.path!==child)throw Error('目录路径不一致：'+child);
       rows.push(...await walk(child,name));
     }
     return rows;
   }
   const items=await list(root),own=selection(items),rows=[];
   if(own.videos.length)return walk(root,root.split('/').pop()||'网盘根目录');
   for(const d of items.filter(f=>f.dir)){
     if(stopped())throw Object.assign(Error('扫描已暂停，请重新扫描'),{paused:true});
     const path=join(root,d.name);if(d.path&&d.path!==path)throw Error('目录路径不一致：'+path);
     const found=await walk(path,d.name);
     if(!found.length)rows.push({name:d.name,path,files:[],error:'未找到可识别的视频文件'});
     else if(found.length>1)rows.push(...found.map(r=>({...r,name:d.name+' / '+r.path.slice(path.length+1),error:'发现多个含视频的子目录，请把扫描目录设为需要的具体版本目录后重试。'+(r.error||'')})));
     else rows.push(...found);
   }
   return rows;
 }
 async function share({row,state,api,account,save,stopped=()=>false}){
   if(row.error)throw Error(row.error);
   if(!row.files?.length||row.files.length>10||row.files.some(f=>f.dir||(episode(f.name)!==f.episode&&!f.manualEpisode)||!Number.isInteger(f.episode)||f.episode<1||f.episode>10)||new Set(row.files.map(f=>f.episode)).size!==row.files.length)throw Error('预览文件选择无效');
   if(stopped())throw Object.assign(Error('已暂停'),{paused:true});
   if(String((await api.identity()).uk)!==String(account))throw Object.assign(Error('网盘账号已变化'),{fatal:true});
   if(state.phase==='done')return state;
   state.shareOptions=state.shareOptions||(state.phase?{period:365,pwd:''}:row.shareOptions||{period:365,pwd:''});
   if(![0,1,7,30,365].includes(state.shareOptions.period)||(state.shareOptions.pwd&&!/^[a-zA-Z0-9]{4}$/.test(state.shareOptions.pwd)))throw Error('分享设置无效');
   if(state.phase==='pending')throw Error('上次创建分享结果不明，请先核对“我的分享”，不会重复创建');
   const current=await api.list(row.path);
   if(row.files.some(f=>!current.some(n=>n.id===f.id&&C.sameFile(f,n))))throw Error('扫描后的文件已发生变化，请重新扫描核对');
   if(!state.phase){
     state.pwd=state.shareOptions.pwd||C.randomPwd();state.started=Date.now();state.phase='pending';await save();
     if(stopped()){delete state.phase;await save();throw Object.assign(Error('已暂停'),{paused:true});}
     try{
       const result=await api.createShare(row.files.map(f=>f.id),state.pwd,state.shareOptions.period);
       state.shareId=String(result.shareid||result.share_id||'');state.rawLink=result.link||result.shorturl||'';
       if(!state.shareId||!state.rawLink)throw Error('分享响应不完整，请核对“我的分享”');
       state.phase='created';await save();
     }catch(e){if(e.definite){delete state.phase;await save();}throw e;}
   }
   if(state.phase==='created'){
     const records=await api.shareRecords(state.shareId),record=records.find(r=>String(r.shareId??r.shareid)===state.shareId);
     if(!record)throw Error('分享记录暂未返回，重试将继续核验');
     try{state.expiry=C.validateRecord(record,row.files.map(f=>f.id),state.started,Date.now(),state.shareOptions.period);}
     catch(e){if(e.mismatch){await api.cancelShare(state.shareId);delete state.phase;delete state.shareId;delete state.rawLink;await save();}throw e;}
     const link=new URL(state.rawLink);if(link.hostname!=='pan.baidu.com'||!/^\/s\/1[\w-]+$/.test(link.pathname))throw Error('百度返回的新分享链接格式异常');
     link.protocol='https:';link.searchParams.set('pwd',state.pwd);state.link=link.href;state.phase='done';state.error='';await save();
   }
   return state;
 }
 async function exportExcel(rows,ExcelJS){const w=new ExcelJS.Workbook(),s=w.addWorksheet('前10集预览');s.addRow(['文件夹','分享链接']);s.getRow(1).font={bold:true};s.getColumn(1).width=48;s.getColumn(2).width=80;for(const r of rows){const link=r.state?.phase==='done'?r.state.link:'';s.addRow([r.name,link?{text:link,hyperlink:link}:'']);}return w.xlsx.writeBuffer();}
 return {episode,reviewSelection,pathValue,selection,scan,share,exportExcel};
});
