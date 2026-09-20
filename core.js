/* Excel batch transfer core. MIT. Transfer workflow adapted from aitippro/baidu-pan-batch-transfer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PanExcel=api;})(globalThis,function(){
  'use strict';
  const DAY=86400, PERIOD=365;
  const phases={'new':'待处理','prepared':'待转存','transfer-pending':'转存待核实','transferred':'已转存，待分享','share-pending':'分享请求待核实','share-created':'分享已创建，待核验','done':'完成'};
  function fail(message,extra={}) {return Object.assign(new Error(message),extra);}
  function parseShare(text) {
    text=String(text||'');
    const found=[];
    for(const match of text.matchAll(/https?:\/\/(?:pan|yun)\.baidu\.com\/[^\s<>"，。；）]+/g)){
      const url=new URL(match[0].replace(/[.,;)]*$/,''));
      const key=/^\/s\/1([A-Za-z0-9_-]+)$/.exec(url.pathname)?.[1]||(url.pathname==='/share/init'?url.searchParams.get('surl'):null);
      if(key&&/^[A-Za-z0-9_-]+$/.test(key))found.push({key,url});
    }
    const keys=[...new Set(found.map(m=>m.key))];
    if(keys.length!==1)throw fail(keys.length?'一行含多个不同分享链接，请拆成多行':'未识别到百度分享链接');
    const passwords=new Set();
    for(const m of found){const p=m.url.searchParams.get('pwd');if(p)passwords.add(p);}
    for(const m of text.matchAll(/(?:提取码|密码)\s*[：:]?\s*([A-Za-z0-9]{4})(?![A-Za-z0-9])/g))passwords.add(m[1]);
    if(passwords.size>1)throw fail('同一行提取码不一致');
    const pwd=[...passwords][0]||'';
    if(pwd&&!/^[A-Za-z0-9]{4}$/.test(pwd))throw fail('提取码必须是4位字母或数字');
    return {key:keys[0],pwd,url:'https://pan.baidu.com/s/1'+keys[0]};
  }
  function normalizePath(path){
    path=String(path||'').trim();if(!path)throw fail('转存路径不能为空');
    if(!path.startsWith('/'))throw fail('转存路径必须以 / 开头');
    if(/[\\\x00-\x1f]/.test(path))throw fail('路径含反斜杠或控制字符');
    const parts=path.split('/').filter(Boolean);
    if(parts.some(p=>p==='.'||p==='..'))throw fail('路径不能包含 . 或 ..');
    const replacements={':':'：','*':'＊','?':'？','"':'＂','<':'＜','>':'＞','|':'｜'};
    return '/'+parts.map(p=>p.replace(/[:*?"<>|]/g,c=>replacements[c])).join('/');
  }
  function parseTextShares(text,target){
    target=normalizePath(target);
    text=String(text||'').replace(/\[(https?:\/\/(?:pan|yun)\.baidu\.com\/[^\]\s]+)\]\(\1\)/g,'$1');
    const links=[...text.matchAll(/https?:\/\/(?:pan|yun)\.baidu\.com\/[^\s<>"，。；）]+/g)];
    if(!links.length)throw fail('未识别到百度分享链接，请粘贴链接及提取码');
    return links.map((m,i)=>{
      const raw=text.slice(m.index,links[i+1]?.index??text.length).trim();
      const path=/目标目录\s*[：:]\s*([^\r\n]+)/.exec(raw)?.[1];
      const source=parseShare(raw);
      return {raw,source,target:path?normalizePath(path):target,name:'文本分享 '+(i+1)};
    });
  }
  function cellText(cell){
    const flatten=v=>{
      if(v&&typeof v==='object'){
        if(v.hyperlink)return String(v.hyperlink)+(v.text?' '+flatten(v.text):'');
        if(v.richText)return v.richText.map(x=>flatten(x.text)).join('');
        if('formula' in v||'sharedFormula' in v)return flatten(v.result);
        if('text' in v)return flatten(v.text);
        return '';
      }
      return String(v??'');
    };
    return flatten(cell.value);
  }
  const INPUT_HEADERS=['序号','原始链接','转存路径','备注'];
  function createTemplate(ExcelJS,{example=true}={}){
    const w=new ExcelJS.Workbook(),s=w.addWorksheet('导入模板');
    s.addRow(INPUT_HEADERS);s.getRow(1).font={bold:true};s.views=[{state:'frozen',ySplit:1}];
    [10,65,45,35].forEach((width,i)=>{s.getColumn(i+1).width=width;});
    ['选填：序号。','必填：一行一个百度分享链接，可包含提取码。','必填：以 / 开头的完整目录；每行可不同，不存在时自动创建。','选填：备注，导出时保留。'].forEach((note,i)=>{s.getCell(1,i+1).note=note;});
    if(example){
      s.addRow(['教学示例（不处理）','https://pan.baidu.com/s/1EXAMPLE?pwd=abcd','/我的资源/示例目录','仅展示填写格式，链接为虚构。从下一行填写真实任务；保留示例标记则自动跳过。']);
      s.getRow(2).font={color:{argb:'FF68778B'},italic:true};
      s.getRow(2).alignment={wrapText:true,vertical:'top'};s.getRow(2).height=58;
      s.getRow(2).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5FA'}};});
    }
    return w;
  }
  function importTasks(workbook){
    const tasks=[],sheets=[];
    for(const sheet of workbook.worksheets){
      if(!INPUT_HEADERS.every((h,i)=>cellText(sheet.getCell(1,i+1)).trim()===h))continue;
      sheets.push(sheet.name);
      sheet.eachRow({includeEmpty:false},(row,n)=>{
        if(n===1||cellText(row.getCell(1)).trim()==='教学示例（不处理）')return;
        const raw=cellText(row.getCell(2)),targetRaw=cellText(row.getCell(3));
        if(!raw.trim()&&!targetRaw.trim())return;
        const task={key:sheet.name+':'+n,sheet:sheet.name,row:n,raw,target:targetRaw,name:targetRaw.split('/').filter(Boolean).pop()||'第'+n+'行'};
        try{task.source=parseShare(raw);task.target=normalizePath(targetRaw);if(/[:*?"<>|]/.test(targetRaw))task.pathNotice='目标目录字符已自动修正：'+task.target;}catch(e){task.error=e.message;}
        tasks.push(task);
      });
    }
    if(!sheets.length)throw fail('请下载最新四列模板：序号、原始链接、转存路径、备注。结果表及旧模板不能直接导入。');
    const unique=new Map();
    for(const t of tasks){if(t.error)continue;const key=t.source.key+'|'+t.target;if(unique.has(key))t.alias=unique.get(key);else unique.set(key,t.key);}
    return {tasks,sheets};
  }
  async function exportResults(original,states,ExcelJS){
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(original);
    const {tasks,sheets}=importTasks(workbook);
    for(const name of sheets){
      const s=workbook.getWorksheet(name);
      s.spliceColumns(3,0,[]);s.getCell('C1').value='转存链接';s.getColumn(3).width=65;
      s.getCell('C1').font={bold:true};s.getCell('C1').note='仅核验成功的任务输出新链接（含提取码）；失败或未完成留空。';
    }
    for(const t of tasks){
      const state=states[t.alias||t.key]||{},cell=workbook.getWorksheet(t.sheet).getCell(t.row,3);
      cell.value=state.phase==='done'&&state.link?{text:state.link,hyperlink:state.link}:'';
    }
    return workbook.xlsx.writeBuffer();
  }
  function randomPwd(){const alphabet='abcdefghjkmnpqrstuvwxyz23456789';let out='';const bytes=new Uint8Array(16);while(out.length<4){crypto.getRandomValues(bytes);for(const b of bytes){if(b<Math.floor(256/alphabet.length)*alphabet.length)out+=alphabet[b%alphabet.length];if(out.length===4)break;}}return out;}
  function sameSet(a,b){return a.length===b.length&&[...a].map(String).sort().join(',')===[...b].map(String).sort().join(',');}
  function sameFile(a,b){return a.name===b.name&&a.dir===b.dir&&(a.dir||(a.size===b.size&&(!a.md5||!b.md5||a.md5===b.md5)));}
  function sourceChanges(before,after){
    const changes=[];
    const fields={name:'文件名',dir:'类型',size:'大小',md5:'内容校验值'};
    for(const old of before){
      const next=after.find(x=>x.id===old.id);
      if(!next){changes.push('缺少文件或文件ID变化：'+old.name);continue;}
      for(const [key,label] of Object.entries(fields))if(old[key]!==next[key])changes.push(old.name+' 的'+label+'变化（'+String(old[key]??'未提供')+' → '+String(next[key]??'未提供')+'）');
    }
    for(const next of after)if(!before.some(x=>x.id===next.id))changes.push('新增文件：'+next.name);
    return changes;
  }
  function reconcile(expected,own,beforeIds){
    return expected.map(src=>{const matches=own.filter(x=>!beforeIds.includes(x.id)&&sameFile(src,x));if(matches.length!==1)throw fail('转存结果尚不能唯一核实：'+src.name+'。未自动重复转存，请核查网盘后重试。');return matches[0];});
  }
  function validateRecord(record,ids,started,observed=Date.now()){
    if(!sameSet((record.fsIds||record.fs_ids||[]).map(String),ids))throw fail('分享中的文件与原分享不一致',{mismatch:true});
    if(record.status!==undefined&&Number(record.status)!==0)throw fail('百度返回的分享状态异常');
    let end=Number(record.expiredTime??record.expiretime??record.expire_time);
    let interpretation='Unix秒时间戳';
    if(end>1e12){end/=1000;interpretation='Unix毫秒时间戳';}
    else if(end>0&&end<=PERIOD*DAY){end=observed/1000+end;interpretation='剩余有效秒数（读取时刻加剩余秒数）';}
    if(!Number.isFinite(end))throw fail('百度未返回可核实的到期时间');
    const expected=started/1000+PERIOD*DAY;
    if(Math.abs(end-expected)>300){
      const raw=record.expiredTime??record.expiretime??record.expire_time;
      const validDate=Number.isFinite(new Date(end*1000).getTime());
      const diagnostic='请求有效期：365天；expiredTime='+String(raw)+'；解释方式：'+interpretation+'；expiredType='+String(record.expiredType??'未提供')+'；创建请求时间：'+new Date(started).toISOString()+'；预期到期：'+new Date(expected*1000).toISOString()+'；返回到期：'+(end===0?'0（未给出有限到期时间）':validDate?new Date(end*1000).toISOString():'无法转换为日期')+'；按返回时间计算的天数：'+((end-started/1000)/DAY).toFixed(3)+'；与预期相差秒数：'+Math.round(end-expected);
      throw fail('分享记录的到期时间未通过365天核验；已停止，具体返回值见有效期诊断',{mismatch:true,yearUnsupported:true,expiryDiagnostic:diagnostic});
    }
    return new Date(end*1000).toISOString();
  }
  function formatError(task,state,error){
    const fields=['失败时间：'+new Date().toLocaleString(),'工作表：'+(task.sheet||'未知')+'，Excel 第 '+task.row+' 行','失败步骤：'+(error.step||state.step||phases[state.phase]||'读取任务'),'目标目录：'+(task.target||'未解析')];
    if(error.endpoint)fields.push('接口：'+error.endpoint+'，方法：'+error.method+(error.errno!==undefined?'，errno='+error.errno:'')+(error.httpStatus?'，HTTP='+error.httpStatus:''));
    if(error.requestPath)fields.push('本次请求路径：'+error.requestPath);
    if(error.page)fields.push('列表页码：'+error.page);
    if(error.logid)fields.push('百度请求标识：'+error.logid);
    if(error.sourceDiagnostic)fields.push('原分享诊断：'+error.sourceDiagnostic);
    if(error.expiryDiagnostic)fields.push('有效期诊断：'+error.expiryDiagnostic);
    if(error.shareCancelled)fields.push('分享处理：已取消本次未通过核验的新分享；已转存文件保留，下次从分享步骤继续。');
    fields.push('具体原因：'+error.message);
    fields.push('进度：已读取原分享 '+(state.source?.length??'未知')+' 项，已核实转存 '+(state.completed?.length||0)+' 项');
    if(error.uncertain||state.pendingUncertain||state.phase==='share-pending')fields.push('处理建议：请求结果不明，请先核查网盘文件或“我的分享”，不要重复提交。');
    else if(error.endpoint==='/share/list'||error.step==='读取原分享'||state.step==='读取原分享')fields.push('处理建议：先打开原分享确认内容和提取码；本错误发生在原分享读取阶段。');
    else if(error.endpoint==='/api/create')fields.push('处理建议：检查本次请求路径、网盘剩余空间和账号状态。');
    return fields.join('\n');
  }
  async function runTask({task,state,api,account,save,stopped=()=>false}){
    const persist=async()=>{await save();};
    const guard=async()=>{if(stopped())throw fail('已暂停',{paused:true});try{if(String((await api.identity()).uk)!==String(account))throw fail('网盘账号发生变化，已停止',{fatal:true});}catch(e){e.step='核验当前账号';throw e;}};
    if(task.error)throw fail(task.error);
    await guard();if(state.phase==='done')return state;
    state.error='';state.phase=state.phase||'new';
    if(state.phase==='new'){
      state.step='读取原分享';
      state.source=await api.source(task.source);
      if(!state.source.length)throw fail('原分享内容为空');
      if(new Set(state.source.map(x=>x.name)).size!==state.source.length)throw fail('原分享顶层有同名文件，无法保持名称转存');
      state.step='逐级创建目标目录';await api.mkdir(task.target);
      state.step='检查目标目录同名内容';
      const before=await api.list(task.target);
      const reused=[];
      for(const src of state.source){
        const matches=before.filter(o=>o.name===src.name);if(!matches.length)continue;
        const dst=matches[0];
        if(matches.length!==1||!sameFile(src,dst))throw fail('目标目录同名内容与原分享不一致：'+src.name+'，未覆盖或分享');
        if(!src.dir&&(!src.md5||!dst.md5))throw fail('同名文件缺少内容校验值，无法确认可复用：'+src.name);
        reused.push(dst);
      }
      state.beforeIds=before.map(x=>x.id);state.completed=reused;state.reusedIds=reused.map(x=>x.id);state.phase='prepared';await persist();
      if(reused.length)api.onTrace?.('已匹配 '+reused.length+' 项同名内容，将复用并在分享前核验');
    }
    if(['prepared','transfer-pending'].includes(state.phase)){
      // Reopen the source to restore the share-specific cookie after a reload.
      state.step='重新核验原分享';const current=await api.source(task.source);
      const changes=sourceChanges(state.source,current);
      if(changes.length)throw fail('原分享与已保存清单不一致：'+changes.slice(0,10).join('；'));
      state.source=state.source.map(s=>current.find(x=>x.id===s.id));
      while(state.completed.length<state.source.length){
        await guard();
        if(state.phase==='transfer-pending'){
          state.step='核对本批转存结果';
          const own=await api.list(task.target);
          const mapped=reconcile(state.pending,own,state.beforeIds);
          // A lost response cannot prove ownership of a new same-name object. Only accept
          // files after a successful response; uncertain writes require manual review.
          if(state.pendingUncertain)throw fail('转存请求结果不明，请在网盘核实本行；为避免错认文件，未再次转存或分享',{uncertain:true});
          state.completed.push(...mapped);state.pending=null;state.phase='prepared';await persist();
        }else{
          state.step='检查本批转存前的目标目录';
          const remaining=state.source.filter(s=>!state.completed.some(d=>d.name===s.name));
          const own=await api.list(task.target);
          const conflict=remaining.find(s=>own.some(o=>o.name===s.name));
          if(conflict)throw fail('转存前发现同名内容：'+conflict.name+'，已停止此行');
          state.pending=remaining.slice(0,100);state.phase='transfer-pending';state.pendingUncertain=true;await persist();
          state.step='提交转存（本批 '+state.pending.length+' 项）';
          try {await api.transfer(state.pending,task.target);state.pendingUncertain=false;await persist();}
          catch(e){if(e.definite){state.phase='prepared';state.pending=null;state.pendingUncertain=false;await persist();}throw e;}
        }
      }
      state.completed=state.source.map(s=>state.completed.find(d=>d.name===s.name));
      state.phase='transferred';await persist();
    }
    if(state.phase==='transferred'){
      await guard();
      state.step='核验已转存文件';
      // Verify stored IDs still refer to the exact expected objects, including folder contents.
      const own=await api.list(task.target);
      for(let i=0;i<state.source.length;i++){
        const dest=own.find(x=>x.id===state.completed[i].id);
        if(!dest||!sameFile(state.source[i],dest))throw fail('已转存文件被移动、删除或更改，请核查：'+state.source[i].name);
      }
      state.step='逐项核验原分享与转存内容';await api.verifyTree(state.source,state.completed,task.source,state.reusedIds||[]);
      state.pwd=state.pwd||randomPwd();state.started=Date.now();state.phase='share-pending';await persist();
      try {
        state.step='创建365天新分享';
        const result=await api.createShare(state.completed.map(x=>x.id),state.pwd);
        state.shareId=String(result.shareid||result.share_id||'');state.rawLink=result.link||result.shorturl||'';
        if(!state.shareId||!state.rawLink)throw fail('分享接口没有返回完整链接信息；请在我的分享中核查');
        state.phase='share-created';await persist();
      }catch(e){if(e.definite){state.phase='transferred';await persist();}throw e;}
    }
    if(state.phase==='share-pending')throw fail('上次分享请求结果不明，请在“我的分享”核实，未自动重复创建分享',{uncertain:true});
    if(state.phase==='share-created'){
      state.step='核验新分享内容及有效期';
      await guard();const records=await api.shareRecords(state.shareId);
      const record=records.find(r=>String(r.shareId??r.shareid)===state.shareId);
      if(!record)throw fail('新分享尚未出现在分享记录中，稍后重试将只核验，不再转存');
      try{state.expiry=validateRecord(record,state.completed.map(x=>x.id),state.started);}
      catch(e){if(e.expiryDiagnostic){state.expiryDiagnostic=e.expiryDiagnostic;await persist();}if(e.mismatch){await api.cancelShare(state.shareId);e.shareCancelled=true;state.phase='transferred';delete state.shareId;delete state.rawLink;await persist();}throw e;}
      const link=new URL(state.rawLink,'https://pan.baidu.com');
      if(link.hostname!=='pan.baidu.com'||link.protocol!=='https:')throw fail('分享接口返回了异常地址');
      link.searchParams.set('pwd',state.pwd);state.link=link.href;state.phase='done';state.error='';await persist();
    }
    return state;
  }
  return {createTemplate,parseShare,parseTextShares,normalizePath,importTasks,exportResults,randomPwd,runTask,validateRecord,sameFile,sourceChanges,reconcile,phases,formatError};
});
