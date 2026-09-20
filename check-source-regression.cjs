// Local mock only: root share/list deliberately returns -9.
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const C=require('./core.js');
const {BaiduAPI}=require('./api.js');
const E=require('./vendor/exceljs.min.js');
(async()=>{
 const server=spawn(process.execPath,['verify-server.cjs'],{cwd:__dirname,windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Mock server failed to start');})]);
  const base='http://127.0.0.1:8597';
  assert.equal((await(await fetch(base+'/share/list?root=1')).json()).errno,-9);
  const bytes=await(await fetch(base+'/fixture.xlsx')).arrayBuffer();
  const workbook=new E.Workbook();await workbook.xlsx.load(bytes);
  const {tasks}=C.importTasks(workbook);assert.equal(tasks.length,1);
  const api=new BaiduAPI((url,options)=>fetch(base+url,options),async()=>{});
  const state={};await C.runTask({task:tasks[0],state,api,account:'12345',save:async()=>{}});
  assert.equal(state.phase,'done');assert.match(state.link,/1LOCALTEST\?pwd=[a-zA-Z0-9]{4}$/);
  const {mutations}=await(await fetch(base+'/evidence')).json();
  assert.deepEqual(mutations,[{type:'mkdir',path:'/测试/新目录'},{type:'mkdir',path:'/测试/新目录/剧名'},{type:'transfer',path:'/测试/新目录/剧名',ids:[11]},{type:'share',ids:[99],period:'365'}]);
  const result=await C.exportResults(bytes,{[tasks[0].key]:state},E);
  const out=new E.Workbook();await out.xlsx.load(result);
  assert.equal(out.worksheets[0].getCell('B2').text,workbook.worksheets[0].getCell('B2').text);
  assert.ok(out.worksheets[0].getCell('C2').text.includes('1LOCALTEST'));
  console.log('PASS (LOCAL MOCK): '+(process.env.PAN_TEST_SEKEY?'page has no files; share/list requires verified sekey':'share/list=-9; embedded files')+' -> nested mkdir -> transfer -> verified 365-day share -> independent C-column export');
  console.log(JSON.stringify(mutations));
 }finally{server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
