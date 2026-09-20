(function(){
 'use strict';
 const C=globalThis.PanExcel,api=new globalThis.PanExcelAPI.BaiduAPI();
 if(document.getElementById('pan-excel-assistant'))return;
 const host=document.createElement('div');host.id='pan-excel-assistant';document.body.appendChild(host);
 host.style.cssText='position:fixed;right:16px;top:70px;z-index:2147483646;max-width:calc(100vw - 32px)';
 const root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>
 :host{font-family:system-ui,"Microsoft YaHei",sans-serif;font-size:14px;color:#203047;line-height:1.5}
 *{box-sizing:border-box} .panel{width:850px;max-width:calc(100vw - 32px);background:white;border:1px solid #dbe4ef;border-radius:14px;box-shadow:0 16px 65px #10234238;overflow:hidden}
 header{background:#134e83;color:white;padding:13px 18px;display:flex;justify-content:space-between;align-items:center}h2{margin:0;font-size:17px}header button{background:transparent;color:white;border-color:#ffffff66}
 main{padding:16px;max-height:calc(100vh - 155px);overflow:auto}.intro{margin:0 0 12px;color:#54657b;font-size:13px}
 button,.file{font:inherit;border:1px solid #ccd7e5;background:#fff;color:#203047;border-radius:7px;padding:7px 11px;cursor:pointer}button:hover{background:#edf4fc}button:disabled{opacity:.45;cursor:not-allowed}.primary{background:#1464ac;color:white;border-color:#1464ac}.primary:hover{background:#104d83}.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}input[type=file]{max-width:100%;font:inherit}.file{display:block;margin-bottom:12px}
 .summary{padding:10px 12px;background:#edf5fd;border-radius:7px;margin:10px 0;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.error{color:#a22a20} .tablewrap{max-height:310px;overflow:auto;border:1px solid #e0e7ef;border-radius:7px}table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}th{background:#f1f5f9;position:sticky;top:0;text-align:left;padding:8px}td{border-top:1px solid #e6edf4;padding:8px;overflow-wrap:anywhere;vertical-align:top}th:first-child{width:42px}th:nth-child(2){width:46px}th:nth-child(3){width:23%}th:nth-child(4){width:28%}input[type=checkbox]{accent-color:#1464ac}a{color:#125faa}pre{max-height:100px;overflow:auto;white-space:pre-wrap;font:12px/1.6 system-ui;background:#f8fafc;padding:8px;border-radius:6px;margin:10px 0 0}.foot{font-size:12px;color:#68778b;margin-top:10px}main[hidden]{display:none}
 #textInput{display:grid;grid-template-columns:240px minmax(0,1fr);gap:12px}#textInput textarea{margin:0;min-height:110px}#textInput>.toolbar{grid-column:1/-1}@media(max-width:650px){#textInput{grid-template-columns:1fr}} .panel{width:1060px}th:nth-child(3){width:16%}th:nth-child(4){width:25%}.tabs{display:flex;gap:8px;margin-bottom:12px}.tabs button[aria-selected=true]{background:#e8f2ff;color:#125faa;border-color:#7aaee1}textarea,input[type=text]{font:inherit;box-sizing:border-box;border:1px solid #ccd7e5;border-radius:8px;padding:10px;width:100%;color:#203047}textarea{min-height:150px;resize:vertical;margin:10px 0}.copy-link{display:block;text-align:left;width:100%;border:0;background:#edf8f4;color:#08704e;padding:9px;overflow-wrap:anywhere;font-size:12px}.copy-link:hover{background:#d9f0e6}.tablewrap{max-height:380px}.path-edit{font-size:12px!important;padding:6px!important}details{margin-top:12px}summary{cursor:pointer;color:#617087}.success-label{color:#08704e;margin-bottom:5px}[hidden]{display:none!important}
 </style><section class="panel"><header><h2>百度网盘转存与换链助手 · __PAN_VERSION__</h2><button id="fold" aria-label="折叠面板">收起</button></header><main>
 <p class="intro">每行自动创建目标目录，按原分享内容生成新链接。365 天有效 · 随机提取码 · 保留原文件名</p>
 <div class="tabs" role="tablist"><button id="excelTab" role="tab" aria-selected="true">Excel 导入</button><button id="textTab" role="tab" aria-selected="false">粘贴分享文本</button></div>
 <div id="excelInput"><label class="file">选择 Excel（.xlsx） <input id="file" type="file" accept=".xlsx" /></label><div class="toolbar"><button id="downloadTemplate">下载 Excel 模板</button><span class="foot">填写 B 列原始链接、C 列转存路径，每行一条。备注右侧可追加文字列，导出保留；自动新增独立的“转存链接”列。</span></div></div>
 <div id="textInput" hidden><label>默认目标目录 <input id="textTarget" type="text" value="/批量转存" placeholder="/我的资源/剧集" /></label><textarea id="shareText" aria-label="分享链接文本" placeholder="粘贴多条百度网盘分享文案，保留提取码即可。&#10;https://pan.baidu.com/s/1xxxx 提取码：abcd&#10;目标目录：/剧集/第一部&#10;&#10;https://pan.baidu.com/s/1yyyy?pwd=1234"></textarea><div class="toolbar"><button id="parseText">识别并导入任务</button><span class="foot">可在每条链接后写“目标目录：/路径”，或在下方逐条修改。导入不会自动开始。</span></div></div>
 <div class="toolbar"><button id="run" class="primary" disabled>开始处理选中项</button><button id="retry" disabled>重试失败项</button><button id="pause" disabled>暂停</button><button id="copyall" disabled>复制全部新链接</button><button id="export" disabled>导出结果 Excel</button></div>
 <div id="summary" class="summary" role="status">请导入表格。模板为序号、原始链接、转存路径、备注四列。导入不会开始转存。</div>
 <div class="tablewrap"><table><thead><tr><th><input id="selectall" type="checkbox" checked aria-label="选择全部有效行" /></th><th>行号</th><th>资源名称</th><th>目标目录</th><th>状态 / 新链接</th></tr></thead><tbody id="rows"></tbody></table></div>
 <p class="foot">新链接已包含提取码，点击即可复制。进度自动保存；运行期间请保持页面打开。</p>
 <details><summary>诊断与运行日志</summary><div class="toolbar"><button id="connect" disabled>同步账号与进度</button><button id="diagnose" disabled>诊断首条</button><button id="trial" disabled>仅处理首条</button><button id="copylog">复制日志</button></div><pre id="log" aria-label="处理日志"></pre></details>
 </main></section>`;
 const $=id=>root.getElementById(id);
 let original=null,filename='',digest='',tasks=[],states={},account='',busy=false,stop=false,storageKey='',connected=false;
 let inputMode='excel',textRows=null;
 const selected=new Set(),views=new Map();
 function note(text){$('log').textContent=(new Date().toLocaleTimeString()+' '+text+'\n'+$('log').textContent).slice(0,6000);}
 api.onTrace=note;
 function status(text,error=false){$('summary').textContent=text;$('summary').classList.toggle('error',error);}
 function summary(){const done=tasks.filter(t=>states[t.alias||t.key]?.phase==='done').length;const bad=tasks.filter(t=>t.error).length;return `${filename} · ${tasks.length} 行 · 已完成 ${done} · 待修正 ${bad} · 已选 ${selected.size}`;}
 function controls(){
   $('file').disabled=busy;$('connect').disabled=busy||!original;$('trial').disabled=busy||!original||!selected.size;
   $('diagnose').disabled=busy||!original||!selected.size;
   $('run').disabled=busy||!original||!selected.size;
   $('retry').disabled=busy||!Object.values(states).some(s=>s.error&&s.phase!=='done');
   for(const id of ['parseText','shareText','textTarget','excelTab','textTab'])$(id).disabled=busy;
   $('copyall').disabled=!Object.values(states).some(s=>s.phase==='done');
   for(const {pathInput} of views.values())if(pathInput)pathInput.disabled=busy||connected;
   $('pause').disabled=!busy;$('export').disabled=busy||!original;$('selectall').disabled=busy;
   for(const {check} of views.values())check.disabled=busy||check.dataset.invalid==='true';
 }
 function render(){
   for(const task of tasks){const view=views.get(task.key);if(!view)continue;const s=states[task.alias||task.key]||{};view.state.textContent='';
     const text=document.createElement('div');text.textContent=task.error||s.error||C.phases[s.phase]||'待处理';if(task.error||s.error)text.className='error';text.style.whiteSpace='pre-wrap';view.state.appendChild(text);
     if(s.phase==='done'){text.className='success-label';text.textContent='完成 · 点击链接复制';const a=document.createElement('button');a.className='copy-link';a.textContent=s.link;a.title='复制新分享链接（含提取码）';a.addEventListener('click',handler(async()=>{await copyText(s.link);status('第 '+task.row+' 行的新链接已复制（含提取码）。');}));view.state.appendChild(a);}
     view.check.checked=selected.has(task.key);
   }
   controls();
 }
 function draw(){
   $('rows').replaceChildren();views.clear();
   for(const task of tasks){const row=document.createElement('tr');const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(task.key);check.setAttribute('aria-label','选择第'+task.row+'行');check.dataset.invalid=String(Boolean(task.error));
     check.addEventListener('change',()=>{if(check.checked)selected.add(task.key);else selected.delete(task.key);status(summary());controls();});
     const cell=document.createElement('td');cell.appendChild(check);row.appendChild(cell);
     for(const value of [task.row,task.name]){const td=document.createElement('td');td.textContent=value;row.appendChild(td);}
     const pathCell=document.createElement('td');let pathInput;
     if(inputMode==='text'&&!connected){pathInput=document.createElement('input');pathInput.type='text';pathInput.className='path-edit';pathInput.value=task.target;pathInput.setAttribute('aria-label','第'+task.row+'行目标目录');pathInput.addEventListener('change',handler(async()=>{let target;try{target=C.normalizePath(pathInput.value);}catch(e){pathInput.value=task.target;throw e;}const entry=textRows[task.row-2];entry.target=target;entry.raw=entry.source.url+(entry.source.pwd?'?pwd='+entry.source.pwd:'')+'\n目标目录：'+target;$('shareText').value=textRows.map(t=>t.raw).join('\n\n');await importTextRows();}));pathCell.appendChild(pathInput);}else pathCell.textContent=task.target;
     if(task.pathNotice){const notice=document.createElement('div');notice.className='foot';notice.textContent='已自动修正目录中的非法字符';pathCell.appendChild(notice);}
     row.appendChild(pathCell);
     const state=document.createElement('td');row.appendChild(state);$('rows').appendChild(row);views.set(task.key,{check,state,pathInput});
   }
   render();
 }
 async function save(){
   if(!storageKey)throw Error('进度存储尚未绑定账号');
   const serialized=JSON.stringify({version:1,account,digest,states});
   GM_setValue(storageKey,serialized);
   if(GM_getValue(storageKey,'')!==serialized)throw Object.assign(Error('进度保存失败，已停止以避免重复处理'),{fatal:true});
   render();
 }
 async function connect(){
   const identity=await api.identity();account=identity.uk;storageKey='pan-excel-v1:'+account+':'+digest;
   const saved=GM_getValue(storageKey,'');
   if(saved){const data=JSON.parse(saved);if(data.account!==account||data.digest!==digest||data.version!==1)throw Error('进度记录与文件或账号不匹配');states=data.states||{};}else states={};
   connected=true;render();status(summary()+'\n已读取当前网盘账号和本文件进度。');
 }
 async function load(file,stableInput){
   if(!file)return;if(!/\.xlsx$/i.test(file.name))throw Error('请先将表格另存为 .xlsx 格式');
   busy=true;connected=false;controls();status('正在读取 Excel…');
   try{
     const buffer=await file.arrayBuffer();const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
     const parsed=C.importTasks(workbook);const hash=await crypto.subtle.digest('SHA-256',stableInput?new TextEncoder().encode(stableInput):buffer);
     original=buffer;filename=file.name;digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');tasks=parsed.tasks;states={};selected.clear();
     for(const t of tasks)if(!t.error)selected.add(t.key);
     draw();status(summary()+'\n导入完成，检查目标目录后点击“开始处理选中项”。');note('已读取 '+tasks.length+' 行，尚未执行转存。');
   }finally{busy=false;controls();}
 }
 async function execute(firstOnly,failedOnly=false){
   if(busy||!original)return;
   if(!navigator.locks)throw Error('当前浏览器不支持任务互斥，请使用新版 Edge 或 Chrome');
   busy=true;stop=false;controls();
   try{await navigator.locks.request('pan-excel-transfer',{ifAvailable:true},async lock=>{
     if(!lock)throw Error('另一个网盘页面正在处理，请先暂停那里');
     await connect();
     const queue=tasks.filter(t=>(failedOnly?Boolean(states[t.alias||t.key]?.error):selected.has(t.key))&&!t.error&&states[t.alias||t.key]?.phase!=='done');
     const unique=[...new Map(queue.map(t=>[t.alias||t.key,t])).values()];
     for(const entry of (firstOnly?unique.slice(0,1):unique)){
       if(stop)break;
       const task=entry.alias?tasks.find(t=>t.key===entry.alias):entry;
       const state=states[task.key]||(states[task.key]={phase:'new'});
       status(summary()+'\n正在处理：'+task.name);note('第 '+task.row+' 行：开始处理');
       try{await C.runTask({task,state,api,account,save,stopped:()=>stop});note('第 '+task.row+' 行：完成，分享范围与365天有效期已核验');}
       catch(e){state.error=C.formatError(task,state,e);await save();note(state.error);if(e.fatal||e.yearUnsupported||e.paused){stop=true;break;}}
       render();
     }
     status(summary()+(stop?'\n已暂停，可导出当前结果。':'\n本轮结束，可导出结果或选中未完成行重试。'));
   });}finally{busy=false;controls();render();}
 }
 function download(data,name,type){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function copyText(text){if(typeof GM_setClipboard==='function'){GM_setClipboard(text,'text');return;}await navigator.clipboard.writeText(text);}
 async function exportFile(){if(!original||busy)return;busy=true;controls();try{const bytes=await C.exportResults(original,states,ExcelJS);download(bytes,filename.replace(/\.xlsx$/i,'')+'-换链结果.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');note('已导出结果；未完成行的新分享链接留空。');}finally{busy=false;controls();}}
 function handler(fn){return (...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>{status(e.message,true);note(e.message);controls();});}
 $('downloadTemplate').addEventListener('click',handler(async()=>{
   const button=$('downloadTemplate');button.disabled=true;
   try{
     const workbook=C.createTemplate(ExcelJS);
     download(await workbook.xlsx.writeBuffer(),'百度网盘转存-导入模板.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
     note('已生成含教学示例的 Excel 模板。第二行自动跳过，从第三行填写 B、C 列后保存，再选择文件导入。');
   }finally{button.disabled=false;}
 }));
 $('file').addEventListener('change',e=>{const file=e.target.files[0];handler(()=>{inputMode='excel';return load(file);})();});
 for(const mode of ['excel','text'])$(mode+'Tab').addEventListener('click',()=>{for(const m of ['excel','text']){$(m+'Input').hidden=m!==mode;$(m+'Tab').setAttribute('aria-selected',String(m===mode));}});
 async function importTextRows(){
   const w=C.createTemplate(ExcelJS,{example:false}),s=w.worksheets[0];
   for(const [i,t] of textRows.entries())s.addRow([i+1,t.raw,t.target,'']);
   const bytes=await w.xlsx.writeBuffer();inputMode='text';
   await load({name:'文本导入.xlsx',arrayBuffer:async()=>bytes},'text-v1:'+JSON.stringify(textRows.map(t=>[t.raw,t.target])));
 }
 $('parseText').addEventListener('click',handler(async()=>{textRows=C.parseTextShares($('shareText').value,$('textTarget').value);await importTextRows();}));
 $('copyall').addEventListener('click',handler(async()=>{const links=[...new Set(tasks.map(t=>states[t.alias||t.key]).filter(s=>s?.phase==='done').map(s=>s.link))];await copyText(links.join('\n'));status('已复制 '+links.length+' 条新链接（含提取码）。');}));
 $('connect').addEventListener('click',handler(async()=>{busy=true;controls();try{await connect();}finally{busy=false;controls();}}));
 $('diagnose').addEventListener('click',handler(async()=>{
   if(busy)return;const task=tasks.find(t=>selected.has(t.key)&&!t.error);if(!task)return;
   busy=true;controls();try{
     await navigator.locks.request('pan-excel-transfer',{ifAvailable:true},async lock=>{if(!lock)throw Error('另一个页面正在处理，请先暂停那里');note('第 '+task.row+' 行：只读诊断');const result=await api.diagnose(task,note);status(result.ok?'诊断通过，可试跑首条。':'诊断发现问题，请点击“复制日志”发给我定位。',!result.ok);});
   }finally{busy=false;controls();}
 }));
 $('copylog').addEventListener('click',handler(async()=>{const text='百度网盘转存与换链助手 __PAN_VERSION__\n'+$('log').textContent;await copyText(text);status('日志已复制，可直接粘贴发送。');}));
 $('trial').addEventListener('click',handler(()=>execute(true)));$('run').addEventListener('click',handler(()=>execute(false)));
 $('retry').addEventListener('click',handler(()=>execute(false,true)));
 $('pause').addEventListener('click',()=>{stop=true;status('正在暂停，等待当前请求结束并保存进度…');});
 $('export').addEventListener('click',handler(exportFile));
 $('selectall').addEventListener('change',()=>{selected.clear();if($('selectall').checked)for(const t of tasks)if(!t.error)selected.add(t.key);render();status(summary());});
 $('fold').addEventListener('click',()=>{const main=root.querySelector('main');main.hidden=!main.hidden;$('fold').textContent=main.hidden?'展开':'收起';});
 window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
})();
