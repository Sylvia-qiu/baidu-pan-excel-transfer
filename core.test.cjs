const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ExcelJS = require('./vendor/exceljs.min.js');
const C = fs.existsSync(__dirname + '/core.js') ? require('./core.js') : {};
test('invalid destination punctuation is converted without changing directory boundaries',()=>{
 assert.equal(C.normalizePath('/资源/示例标题?'),'/资源/示例标题？');
 assert.equal(C.normalizePath('/a:b/c*?"<>|'),'/a：b/c＊？＂＜＞｜');
 assert.equal(C.normalizePath('/a：b/c＊？＂＜＞｜'),'/a：b/c＊？＂＜＞｜');
 assert.throws(()=>C.normalizePath('/a/../b'));
});
test('source comparison ignores order and path but explains content changes',()=>{
 const a={id:'1',name:'1.mp4',dir:false,size:10,md5:'aaa',path:'/old/1.mp4'},b={...a,id:'2',name:'2.mp4'};
 assert.deepEqual(C.sourceChanges([a,b],[{...b,path:'/new/2.mp4'},{...a,path:'/new/1.mp4'}]),[]);
 assert.match(C.sourceChanges([a],[{...a,size:11}]).join(''),/1.mp4.*大小/);
 assert.match(C.sourceChanges([a],[{...a,md5:'bbb'}]).join(''),/校验值/);
 assert.match(C.sourceChanges([a],[]).join(''),/缺少文件/);
});
test('text import separates multiline passwords and supports a destination for each share',()=>{
 const rows=C.parseTextShares('通过网盘分享的文件：甲\nhttps://pan.baidu.com/s/1abc 提取码：1234\n目标目录：/剧/甲\n\n通过网盘分享的文件：乙\nhttps://pan.baidu.com/s/1def?pwd=abcd','/默认');
 assert.equal(rows.length,2);assert.equal(rows[0].source.pwd,'1234');assert.equal(rows[0].target,'/剧/甲');assert.equal(rows[1].source.pwd,'abcd');assert.equal(rows[1].target,'/默认');
 assert.throws(()=>C.parseTextShares('没有链接','/默认'));
 assert.throws(()=>C.parseTextShares('https://pan.baidu.com/s/1abc 提取码：1234 密码：abcd','/默认'));
});
test('live remaining-seconds record passes yearly expiry including delayed resume',()=>{
 const started=Date.parse('2026-09-18T11:15:42.420Z');
 const record={fsIds:['99'],status:0,expiredType:0,expiredTime:31535998};
 assert.equal(C.validateRecord(record,['99'],started,started+2000),'2027-09-18T11:15:42.420Z');
 assert.equal(C.validateRecord({...record,expiredTime:31536000-86400},['99'],started,started+86400000),'2027-09-18T11:15:42.420Z');
 for(const expiredTime of [0,-1,604800,2592000])assert.throws(()=>C.validateRecord({...record,expiredTime},['99'],started,started+2000));
});
test('resume from already-transferred state accepts countdown expiry without another transfer',async()=>{
 const f=fixture({rejectShare:true});await assert.rejects(C.runTask({...f,account:'user1'}));
 f.api.createShare=async()=>({shareid:'123',link:'https://pan.baidu.com/s/1NEW'});
 f.api.shareRecords=async()=>[{shareId:'123',fsIds:['99'],expiredTime:31535998,expiredType:0,status:0}];
 await C.runTask({...f,account:'user1'});
 assert.equal(f.state.phase,'done');assert.equal(f.calls.filter(x=>x[0]==='transfer').length,1);assert.equal(f.calls.filter(x=>x[0]==='cancel').length,0);
});
test('expiry mismatch reports actual returned fields and duration without guessing account support',()=>{
 const started=Date.UTC(2026,8,18,11,10,0);
 assert.throws(()=>C.validateRecord({fsIds:['99'],status:0,expiredTime:started/1000+7*86400,expiredType:7},['99'],started),e=>{
  assert.match(e.message,/365/);assert.match(e.expiryDiagnostic,/7\.000/);assert.match(e.expiryDiagnostic,/expiredType=7/);return true;
 });
});
test('detailed errors retain row, failing step, nested path and API evidence',()=>{
 const message=C.formatError({sheet:'导入模板',row:2,target:'/父/子'},{step:'逐级创建目标目录',phase:'new'},Object.assign(Error('目录或文件不存在'),{endpoint:'/api/create',method:'POST',errno:-9,requestPath:'/父',logid:'123'}));
 for(const expected of ['Excel 第 2 行','逐级创建目标目录','目标目录：/父/子','本次请求路径：/父','errno=-9','百度请求标识：123'])assert.ok(message.includes(expected));
});

test('extract one share from multiline text and reject conflicting passwords or multiple shares', () => {
  assert.equal(typeof C.parseShare, 'function');
  assert.deepEqual(C.parseShare('分享的文件：01.mp4\n链接：https://pan.baidu.com/s/1Abc_2?pwd=0abc 提取码：0abc\n来自网盘'), {key:'Abc_2',pwd:'0abc',url:'https://pan.baidu.com/s/1Abc_2'});
  assert.throws(() => C.parseShare('https://pan.baidu.com/s/1abc?pwd=abcd 提取码: efgh'));
  assert.throws(() => C.parseShare('https://pan.baidu.com/s/1abc https://pan.baidu.com/s/1def'));
  assert.throws(() => C.parseShare('https://pan.baidu.com.evil.test/s/1abc'));
});
test('paths preserve Chinese and punctuation; reject traversal and empty paths', () => {
  assert.equal(typeof C.normalizePath, 'function');
  assert.equal(C.normalizePath('/资源/示例：中文目录与标点/'), '/资源/示例：中文目录与标点');
  assert.throws(() => C.normalizePath(''));
  assert.throws(() => C.normalizePath('/a/../b'));
});
test('share init query passwords are retained regardless of query order',()=>{
 assert.deepEqual(C.parseShare('https://pan.baidu.com/share/init?surl=abc&pwd=0001'),{key:'abc',pwd:'0001',url:'https://pan.baidu.com/s/1abc'});
 assert.equal(C.parseShare('https://pan.baidu.com/share/init?pwd=0001&surl=abc').pwd,'0001');
});
const source=[{id:'11',name:'01.mp4',dir:false,size:100,md5:'aaa',path:'/src/01.mp4'}];
function fixture(options={}) {
  const state={}; const calls=[]; let own=options.own || []; let shares=[];
  const api={
    identity:async()=>({uk:options.uk||'user1'}),
    source:async()=>structuredClone(source), mkdir:async p=>calls.push(['mkdir',p]),
    list:async()=>structuredClone(own),
    transfer:async(items,path)=>{calls.push(['transfer',items.map(x=>x.id),path]);own=[...own,...items.map(x=>({...x,id:'99',path:path+'/'+x.name}))];if(options.lostTransfer)throw Error('connection lost');return {errno:0};},
    verifyTree:async()=>{},
    createShare:async(ids,pwd)=>{calls.push(['share',ids]);if(options.rejectShare)throw Object.assign(Error('rejected'),{definite:true});shares=[{shareId:'123',fsIds:['99'],expiredTime:Math.floor(Date.now()/1000)+365*86400,shortlink:'https://pan.baidu.com/s/1NEW',status:0}];return {shareid:'123',link:'https://pan.baidu.com/s/1NEW'};},
    shareRecords:async()=>shares,
    cancelShare:async()=>calls.push(['cancel']),
  };
  return {state,calls,api,task:{key:'row2',row:2,target:'/a/b',source:{key:'abc',pwd:'abcd'},name:'剧A'},save:async()=>{}};
}
test('engine shares transferred file ids only, never existing directory files',async()=>{
  assert.equal(typeof C.runTask,'function');
  const f=fixture({own:[{id:'88',name:'private.txt',dir:false,size:1}]});
  await C.runTask({...f,account:'user1'});
  assert.equal(f.state.phase,'done'); assert.deepEqual(f.calls.find(x=>x[0]==='share'),['share',['99']]);
});
test('share failure resume does not transfer files twice',async()=>{
  assert.equal(typeof C.runTask,'function');
  const f=fixture({rejectShare:true}); await assert.rejects(C.runTask({...f,account:'user1'}));
  assert.equal(f.state.phase,'transferred');
  f.api.createShare=async()=>({shareid:'123',link:'https://pan.baidu.com/s/1NEW'});
  f.api.shareRecords=async()=>[{shareId:'123',fsIds:['99'],expiredTime:Math.floor(Date.now()/1000)+365*86400,status:0}];
  await C.runTask({...f,account:'user1'}); assert.equal(f.state.phase,'done');
  assert.equal(f.calls.filter(x=>x[0]==='transfer').length,1);
});
test('lost transfer response never triggers another POST or an unproven share',async()=>{
  assert.equal(typeof C.runTask,'function'); const f=fixture({lostTransfer:true});
  await assert.rejects(C.runTask({...f,account:'user1'})); assert.equal(f.state.phase,'transfer-pending');
  await assert.rejects(C.runTask({...f,account:'user1'})); assert.notEqual(f.state.phase,'done');
  assert.equal(f.calls.filter(x=>x[0]==='transfer').length,1);
  assert.equal(f.calls.filter(x=>x[0]==='share').length,0);
});
test('existing same-name different file blocks transfer and sharing',async()=>{
  assert.equal(typeof C.runTask,'function');const f=fixture({own:[{id:'88',name:'01.mp4',dir:false,size:100,md5:'different'}]});
  await assert.rejects(C.runTask({...f,account:'user1'}));assert.equal(f.calls.filter(x=>x[0]==='share'||x[0]==='transfer').length,0);
});
test('identical existing file is shared directly without transfer',async()=>{
 const f=fixture({own:[{...source[0],id:'99',path:'/a/b/01.mp4'}]});
 await C.runTask({...f,account:'user1'});
 assert.equal(f.state.phase,'done');assert.equal(f.calls.filter(x=>x[0]==='transfer').length,0);
 assert.deepEqual(f.calls.find(x=>x[0]==='share'),['share',['99']]);
});
test('partial reuse transfers only missing items and preserves source order',async()=>{
 const existing={...source[0],id:'88',name:'02.mp4',path:'/a/b/02.mp4'};
 const f=fixture({own:[existing]});f.api.source=async()=>[source[0],{...source[0],id:'12',name:'02.mp4',path:'/src/02.mp4'}];
 f.api.shareRecords=async()=>[{shareId:'123',fsIds:['99','88'],expiredTime:31535998,status:0}];
 await C.runTask({...f,account:'user1'});
 assert.deepEqual(f.calls.find(x=>x[0]==='transfer')[1],['11']);
 assert.deepEqual(f.calls.find(x=>x[0]==='share')[1],['99','88']);
});
test('account changes cannot reuse saved transfer ids',async()=>{
  assert.equal(typeof C.runTask,'function');const f=fixture({uk:'user2'});
  await assert.rejects(C.runTask({...f,account:'user1'}));assert.equal(f.calls.length,0);
});
test('a permanent or wrong-content share is revoked, not exported as a yearly share',async()=>{
  assert.equal(typeof C.runTask,'function');const f=fixture();
  f.api.shareRecords=async()=>[{shareId:'123',fsIds:['99'],expiredTime:0,status:0}];
  await assert.rejects(C.runTask({...f,account:'user1'}));
  assert.notEqual(f.state.phase,'done');assert.equal(f.calls.filter(x=>x[0]==='cancel').length,1);
});
