(function(){
 'use strict';
 const root=document.getElementById('pan-excel-assistant')?.shadowRoot,P=globalThis.PanPreview;
 if(!root||!P)return;
 const api=new globalThis.PanExcelAPI.BaiduAPI(),box=document.createElement('details');box.id='preview-tool';
 box.style.cssText='border:1px solid #b5cfe9;border-radius:10px;padding:12px;margin:0 0 14px;background:#f6faff';
 box.innerHTML=`<summary style="font-weight:700;color:#134e83">网盘已有剧集 · 批量分享前 10 集 · __PAN_VERSION__</summary><p class="foot">按集数选取 1–10 集视频；外层没有剧集时向内查找。先扫描核对，再创建分享。365 天有效 · 随机提取码。</p><label>扫描目录 <input id="pv-path" type="text" placeholder="/资源/剧单" /></label><div class="toolbar" style="margin-top:10px"><button id="pv-current">使用当前网盘目录</button><button id="pv-scan">扫描目录（不分享）</button><button id="pv-run" class="primary" disabled>分享选中剧目的前 10 集</button><button id="pv-retry" disabled>重试失败项</button><button id="pv-stop" disabled>暂停</button><button id="pv-export" disabled>导出预览链接 Excel</button></div><div id="pv-status" class="summary" role="status">请选择剧单根目录，然后扫描。此功能直接分享已有视频，不转存、不移动文件。</div><div id="pv-progress" role="status" aria-live="polite" style="padding:8px 0;font-weight:600"></div><div class="tablewrap"><table><thead><tr><th><input id="pv-all" type="checkbox" checked aria-label="选择全部可分享剧目" /></th><th style="width:22%">文件夹</th><th style="width:40%">识别结果 / 实际目录</th><th>状态 / 预览链接</th></tr></thead><tbody id="pv-rows"></tbody></table></div>`;
 root.querySelector('main').insertBefore(box,root.querySelector('.tabs'));
 const $=id=>box.querySelector('#pv-'+id);
 let rows=[],busy=false,stop=false,account='',scannedRoot='',key='',stored={};
 const message=t=>{$('status').textContent=t;};api.onTrace=message;
 function pagePath(){const q=location.hash.includes('?')?location.hash.split('?').slice(1).join('?'):location.hash.replace(/^#/,'');return new URLSearchParams(q).get('path')||'/';}
 $('path').value=pagePath();
 function fingerprint(r){return JSON.stringify([r.path,r.files.map(f=>[f.id,f.name,f.size,f.md5,f.episode])]);}
 function candidateFingerprint(r){return JSON.stringify((r.candidates||[]).map(f=>[f.id,f.name,f.size,f.md5]).sort((a,b)=>a[0].localeCompare(b[0])));}
 function reviewProgress(){const remaining=rows.filter(r=>r.error||(!r.reviewed&&r.warning)).length;return '共 '+rows.length+' 项 · 已手动核对 '+rows.filter(r=>r.reviewed).length+' 项 · 还剩 '+remaining+' 项需核对';}
 function openReview(r){
   if(busy||r.state.phase)return;
   const dialog=document.createElement('dialog');dialog.style.cssText='width:min(800px,85vw);max-height:80vh;border:1px solid #b5cfe9;border-radius:12px;padding:20px';
   const title=document.createElement('h3');title.textContent='核对文件：'+r.name;
   const info=document.createElement('p');info.textContent='已完整读取目录。每集只勾选一个版本；所有集数都可以手动修改，以你确认的结果为准。只允许第 1–10 集。';
   const list=document.createElement('div');list.style.cssText='max-height:50vh;overflow:auto';const entries=[];
   for(const f of r.candidates){
     const n=P.episode(f.name);
     const line=document.createElement('label');line.style.cssText='display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid #ddd';
     const check=document.createElement('input');check.type='checkbox';check.dataset.id=f.id;check.style.width='auto';
     const previous=r.files.find(x=>x.id===f.id);check.checked=!!previous&&(r.reviewed||r.files.filter(x=>x.episode===previous.episode).length===1);
     const name=document.createElement('span');name.textContent=f.name;name.style.flex='1';
     const ep=document.createElement('input');ep.type='number';ep.min='1';ep.max='10';ep.value=previous?.episode??n??'';ep.style.width='70px';ep.setAttribute('aria-label',f.name+' 的集数');
     line.append(check,name,ep);list.append(line);entries.push({f,check,ep});
   }
   const progress=document.createElement('p');progress.textContent=reviewProgress();
   const selectionProgress=document.createElement('p');const updateSelection=()=>{selectionProgress.textContent='本剧已勾选 '+entries.filter(e=>e.check.checked).length+' 个文件（最多 10 个）';};for(const e of entries){e.check.onchange=updateSelection;e.ep.oninput=updateSelection;}updateSelection();
   const error=document.createElement('p');error.className='error';error.setAttribute('role','alert');
   const confirm=document.createElement('button');confirm.textContent='确认所选文件';confirm.id='pv-review-confirm';
   confirm.onclick=async()=>{try{
     const files=P.reviewSelection(r,entries.filter(e=>e.check.checked).map(e=>({id:e.f.id,episode:Number(e.ep.value),manualEpisode:true})));
     r.files=files;r.error='';r.warning='已手动核对，选中 '+files.length+' 集';r.reviewed=true;r.selected=true;r.state={};await save();dialog.close();message('已核对：'+r.name+'。现在可以勾选并分享。');
   }catch(e){error.textContent=e.message;}};
   const cancel=document.createElement('button');cancel.textContent='返回';cancel.onclick=()=>dialog.close();dialog.append(title,info,progress,selectionProgress,list,error,confirm,cancel);root.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 }
 function ready(){return rows.length&&$('path').value.trim()===scannedRoot;}
 function controls(){
   for(const id of ['path','current','scan','all'])$(id).disabled=busy;
   $('run').disabled=busy||!ready()||!rows.some(r=>r.selected&&!r.error&&r.state.phase!=='done');
   $('retry').disabled=busy||!ready()||!rows.some(r=>r.state.error&&!r.error&&r.state.phase!=='done');
   $('stop').disabled=!busy;$('export').disabled=busy||!rows.length;
   for(const c of $('rows').querySelectorAll('input,button.review'))c.disabled=busy||c.dataset.invalid==='true';
 }
 function render(){
   $('progress').textContent=rows.length?reviewProgress():'';
   $('rows').replaceChildren();
   for(const r of rows){
     const tr=document.createElement('tr'),check=document.createElement('input');check.type='checkbox';check.checked=r.selected;check.dataset.invalid=String(Boolean(r.error));check.setAttribute('aria-label','选择 '+r.name);check.onchange=()=>{r.selected=check.checked;controls();};
     const td=document.createElement('td');td.append(check);tr.append(td);
     for(const text of [r.name,r.path+'\n'+(r.readCount===undefined?'目录未完整读取':'已完整读取 '+r.readCount+' 项')+'\n'+r.files.map(f=>'第 '+f.episode+' 集：'+f.name).join('\n')+(r.warning?'\n'+r.warning:'')]){const cell=document.createElement('td');cell.textContent=text;cell.style.whiteSpace='pre-wrap';tr.append(cell);}
     const cell=document.createElement('td');cell.style.whiteSpace='pre-wrap';cell.textContent=r.error||r.state.error||({done:'完成',created:'待核验分享',pending:'创建结果待核实'}[r.state.phase]||'待分享');
     if(r.error||r.state.error)cell.className='error';
     if(r.state.phase==='done'){const button=document.createElement('button');button.className='copy-link';button.textContent=r.state.link;button.onclick=handler(async()=>{if(typeof GM_setClipboard==='function')GM_setClipboard(r.state.link,'text');else await navigator.clipboard.writeText(r.state.link);message('已复制：'+r.name);});cell.append(button);}
     if(r.candidates?.length&&!r.state.phase){const review=document.createElement('button');review.className='review';review.textContent='核对 / 选择文件';review.onclick=()=>openReview(r);cell.append(document.createElement('br'),review);}
     tr.append(cell);$('rows').append(tr);
   }
   controls();
 }
 async function save(){
   for(const r of rows){const old=stored[r.path];if(old&&old.fingerprint!==fingerprint(r)&&['pending','created'].includes(old.state?.phase))continue;stored[r.path]={fingerprint:fingerprint(r),state:r.state,reviewed:r.reviewed?{candidates:candidateFingerprint(r),files:r.files}:null};}
   const value=JSON.stringify({version:1,account,root:scannedRoot,rows:stored});GM_setValue(key,value);
   if(GM_getValue(key,'')!==value)throw Object.assign(Error('预览进度保存失败，已停止'),{fatal:true});render();
 }
 function handler(fn){return()=>Promise.resolve().then(fn).catch(e=>{message(e.message);controls();});}
 $('current').onclick=()=>{$('path').value=pagePath();controls();};$('path').oninput=controls;
 $('scan').onclick=handler(async()=>{
   if(busy)return;busy=true;stop=false;controls();
   try{
     const path=P.pathValue($('path').value);$('path').value=path;account=(await api.identity()).uk;
     rows=[];scannedRoot='';render();
     const found=await P.scan({root:path,list:p=>api.list(p),stopped:()=>stop,trace:message});
     scannedRoot=path;key='pan-preview-v1:'+account+':'+path;stored={};
     const raw=GM_getValue(key,'');if(raw){const data=JSON.parse(raw);if(data.version!==1||data.account!==account||data.root!==path)throw Error('保存的预览进度与当前账号或目录不符');stored=data.rows||{};}
     rows=found.map(r=>{const old=stored[r.path];if(old?.reviewed?.candidates===candidateFingerprint(r)){try{r.files=P.reviewSelection(r,old.reviewed.files);r.error='';r.warning='已恢复手动核对结果';r.reviewed=true;}catch{}}const state=old?.fingerprint===fingerprint(r)?old.state:{};return {...r,state,selected:!r.error&&state.phase!=='done'};});
     // Never hide an unresolved write merely because files changed between scans.
     for(const r of rows){const old=stored[r.path];if(old&&old.fingerprint!==fingerprint(r)&&['pending','created'].includes(old.state?.phase))r.error='该目录上次分享尚未核实，且文件已变化。请先核对我的分享。';}
     message('扫描完成：'+rows.length+' 项，'+rows.filter(r=>r.error).length+' 项需核对。检查具体文件后，再点击分享。');render();
   }finally{busy=false;controls();}
 });
 async function execute(failedOnly){
   if(busy||!ready())return;if(!navigator.locks)throw Error('请使用支持任务互斥的新版 Edge / Chrome');
   const batchOptions=globalThis.PanShareSettings?.read('preview')||{period:365,pwd:''};
   busy=true;stop=false;controls();
   try{await navigator.locks.request('pan-excel-transfer',{ifAvailable:true},async lock=>{
     if(!lock)throw Error('另一个转存或预览任务正在运行，请先暂停');
     const latest=GM_getValue(key,'');if(latest){const data=JSON.parse(latest);if(data.account!==account||data.root!==scannedRoot||data.version!==1)throw Error('预览进度账号或目录不一致');stored=data.rows||{};for(const r of rows){const old=stored[r.path];if(old?.fingerprint===fingerprint(r))r.state=old.state;else if(old&&['pending','created'].includes(old.state?.phase))r.error='已有未核实的分享，且文件发生变化，请先核对我的分享。';}}
     for(const row of rows.filter(r=>!r.error&&r.state.phase!=='done'&&(failedOnly?r.state.error:r.selected))){
       if(stop)break;row.shareOptions=batchOptions;row.state.error='';message('正在生成预览：'+row.name);
       try{await P.share({row,state:row.state,api,account,save,stopped:()=>stop});}
       catch(e){row.state.error=e.message;await save();if(e.fatal||e.paused){stop=true;break;}}
       render();
     }
     message((stop?'已暂停':'本轮结束')+'；已完成 '+rows.filter(r=>r.state.phase==='done').length+' 项。可导出两列 Excel。');
   });}finally{busy=false;render();}
 }
 $('run').onclick=handler(()=>execute(false));$('retry').onclick=handler(()=>execute(true));$('stop').onclick=()=>{stop=true;message('正在暂停，等待当前请求完成…');};
 $('all').onchange=()=>{for(const r of rows)r.selected=!r.error&&$('all').checked;render();};
 $('export').onclick=handler(async()=>{const bytes=await P.exportExcel(rows,ExcelJS),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='前10集预览链接.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);});
 window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
 controls();
})();
