const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('./preview.js');
const ExcelJS=require('./vendor/exceljs.min.js');
const file=(n,path='/剧单/甲')=>({id:String(100+n),name:String(n).padStart(2,'0')+'.mp4',path:path+'/'+String(n).padStart(2,'0')+'.mp4',dir:false,size:10,md5:'hash'+n});
test('version suffix is not the episode and manual review chooses exactly one version',()=>{
 assert.equal(P.episode('EP01_V2.mp4'),1);assert.equal(P.episode('EP02_V1.mp4'),2);
 const a={...file(1),name:'EP01_V1.mp4'},b={...file(1),id:'999',name:'EP01_V2.mp4'};
 const row={path:'/剧单/甲',candidates:[a,b,file(2)]};
 const picked=P.reviewSelection(row,[{id:'999',episode:1},{id:'102',episode:2}]);assert.deepEqual(picked.map(f=>f.id),['999','102']);
 assert.throws(()=>P.reviewSelection(row,[{id:'101',episode:1},{id:'999',episode:1}]),/重复/);
 assert.throws(()=>P.reviewSelection(row,[{id:'999',episode:2}]),/集数/);
 assert.throws(()=>P.reviewSelection(row,[{id:'not-found',episode:1}]),/文件/);
});
test('scan exposes unknown names for explicit manual review',async()=>{
 const row=(await P.scan({root:'/甲',list:async()=>[{...file(1,'/甲'),name:'开场正片.mp4'}]}))[0];
 assert.equal(row.candidates.length,1);assert.ok(row.error);
 assert.equal(P.reviewSelection(row,[{id:'101',episode:1}])[0].manualEpisode,true);
 assert.throws(()=>P.reviewSelection(row,[{id:'101',episode:11}]),/1–10/);
});
test('episode parser accepts explicit episode names and rejects unrelated numbers',()=>{
 for(const [name,n] of [['001.mp4',1],['010.mp4',10],['100.mp4',100],['剧名-第1集.mp4',1],['剧名01.mp4',1],['01.mp4',1],['第02集.mp4',2],['剧名-03.mp4',3],['04成片.mp4',4],['EP05.mkv',5]])assert.equal(P.episode(name),n,name);
 for(const name of ['2026.mp4','1080p.mp4','预告.mp4','01-10合集.mp4','第01-10集.mp4','01.jpg','第1集第2集.mp4'])assert.equal(P.episode(name),null,name);
});
test('direct episodes take priority over nested alternate versions and covers',async()=>{
 const visited=[];const rows=await P.scan({root:'/剧单',list:async p=>{visited.push(p);return p==='/剧单'?[{dir:true,name:'甲',path:'/剧单/甲'}]:[file(10),file(1),file(100),{dir:true,name:'无字幕净版',path:'/剧单/甲/无字幕净版'},{dir:true,name:'封面',path:'/剧单/甲/封面'}];}});
 assert.deepEqual(rows[0].files.map(f=>f.episode),[1,10]);assert.deepEqual(visited,['/剧单','/剧单/甲']);
});
test('wrong share scope is cancelled and never exported as completed',async()=>{
 const state={},row={name:'甲',path:'/剧单/甲',files:[{...file(1),episode:1}]};let cancelled=0;
 const api={identity:async()=>({uk:'u'}),list:async()=>[file(1)],createShare:async()=>({shareid:'9',link:'https://pan.baidu.com/s/1X'}),shareRecords:async()=>[{shareId:'9',fsIds:['999'],expiredTime:31536000}],cancelShare:async()=>{cancelled++;}};
 await assert.rejects(P.share({row,state,api,account:'u',save:async()=>{}}),/不一致/);assert.equal(cancelled,1);assert.notEqual(state.phase,'done');
});
test('nested scanning selects episodes 1 to 10 numerically without sharing folders',async()=>{
 const tree={'/剧单':[{name:'甲',path:'/剧单/甲',dir:true}],'/剧单/甲':[{name:'成片',path:'/剧单/甲/成片',dir:true}],'/剧单/甲/成片':Array.from({length:12},(_,i)=>file(12-i,'/剧单/甲/成片'))};
 const rows=await P.scan({root:'/剧单',list:async p=>tree[p]});
 assert.equal(rows.length,1);assert.equal(rows[0].name,'甲');assert.deepEqual(rows[0].files.map(f=>f.episode),[1,2,3,4,5,6,7,8,9,10]);
 assert.equal(rows[0].path,'/剧单/甲/成片');
});
test('short series and duplicate episodes are visible; parallel versions do not auto-share',async()=>{
 const rows=await P.scan({root:'/剧单',list:async p=>p==='/剧单'?[{dir:true,name:'甲',path:'/剧单/甲'}]:[file(1),file(2)]});
 assert.equal(rows[0].files.length,2);assert.match(rows[0].warning,/不足/);
 const duplicate=await P.scan({root:'/剧单/甲',list:async()=>[file(1),{...file(1),id:'999',name:'第01集.mp4'}]});assert.match(duplicate[0].error,/重复/);
 const tree={'/剧单':[{dir:true,name:'甲',path:'/剧单/甲'}],'/剧单/甲':[{dir:true,name:'高清',path:'/剧单/甲/高清'},{dir:true,name:'标清',path:'/剧单/甲/标清'}],'/剧单/甲/高清':[file(1,'/剧单/甲/高清')],'/剧单/甲/标清':[file(1,'/剧单/甲/标清')]};
 const versions=await P.scan({root:'/剧单',list:async p=>tree[p]});assert.ok(versions.every(r=>r.error));
});
test('uncertain share creation never retries; completed share verifies exact IDs and one year',async()=>{
 const row={name:'甲',path:'/剧单/甲',files:[{...file(1),episode:1}]};let calls=0;
 const api={identity:async()=>({uk:'u'}),list:async()=>[file(1)],createShare:async()=>{calls++;throw Error('timeout');}};
 const state={};await assert.rejects(P.share({row,state,api,account:'u',save:async()=>{}}));
 await assert.rejects(P.share({row,state,api,account:'u',save:async()=>{}}),/结果不明/);assert.equal(calls,1);
 const done={};api.createShare=async()=>({shareid:'9',link:'https://pan.baidu.com/s/1PREVIEW'});api.shareRecords=async()=>[{shareId:'9',fsIds:['101'],status:0,expiredTime:31536000}];
 await P.share({row,state:done,api,account:'u',save:async()=>{}});assert.equal(done.phase,'done');assert.match(done.link,/pwd=/);
});
test('changed file, account mismatch and ambiguous selections cannot create shares',async()=>{
 const row={name:'甲',path:'/剧单/甲',files:[{...file(1),episode:1}]};let calls=0;
 const api={identity:async()=>({uk:'u'}),list:async()=>[{...file(1),size:999}],createShare:async()=>{calls++;}};
 await assert.rejects(P.share({row,state:{},api,account:'u',save:async()=>{}}),/变化/);
 await assert.rejects(P.share({row,state:{},api,account:'other',save:async()=>{}}),/账号/);assert.equal(calls,0);
});
test('export is exactly folder name and verified share link; failures stay blank',async()=>{
 const bytes=await P.exportExcel([{name:'甲',state:{phase:'done',link:'https://pan.baidu.com/s/1NEW'}},{name:'乙',state:{phase:'pending',link:'unverified'}}],ExcelJS);
 const w=new ExcelJS.Workbook();await w.xlsx.load(bytes);assert.deepEqual(w.worksheets[0].getRow(1).values.slice(1),['文件夹','分享链接']);assert.equal(w.worksheets[0].getCell('B3').text,'');
});
test('hash-prefixed episodes ignore duplicated media suffixes',()=>{
 for(const n of [1,2,4,10,11,96])assert.equal(P.episode('#'+String(n).padStart(2,'0')+'dalao- mp4.mp4'),n);
 assert.equal(P.episode('mp4.mp4'),null);
});
test('explicit manual correction overrides detected number and survives sharing validation',async()=>{
 const candidate={...file(4),name:'04.mp4'},row={name:'甲',path:'/剧单/甲',candidates:[candidate]};
 row.files=P.reviewSelection(row,[{id:candidate.id,episode:2,manualEpisode:true}]);
 assert.equal(row.files[0].episode,2);assert.equal(row.files[0].manualEpisode,true);
 const state={};const api={identity:async()=>({uk:'u'}),list:async()=>[candidate],createShare:async()=>({shareid:'9',link:'https://pan.baidu.com/s/1X'}),shareRecords:async()=>[{shareId:'9',fsIds:[candidate.id],expiredTime:31536000}]};
 await P.share({row,state,api,account:'u',save:async()=>{}});assert.equal(state.phase,'done');
 assert.throws(()=>P.reviewSelection(row,[{id:candidate.id,episode:11,manualEpisode:true}]),/1–10/);
});
test('preview respects selected period and code and persists settings',async()=>{const row={name:'甲',path:'/剧单/甲',files:[{...file(1),episode:1}],shareOptions:{period:7,pwd:'xy12'}},state={};let count=0;const api={identity:async()=>({uk:'u'}),list:async()=>[file(1)],createShare:async(ids,pwd,period)=>{assert.equal(period,7);assert.equal(pwd,'xy12');count++;return {shareid:'7',link:'https://pan.baidu.com/s/1X'};},shareRecords:async()=>[{shareId:'7',fsIds:['101'],expiredTime:604800}]};await P.share({row,state,api,account:'u',save:async()=>{}});assert.equal(state.shareOptions.period,7);assert.match(state.link,/xy12/);row.shareOptions={period:1,pwd:'zz99'};await P.share({row,state,api,account:'u',save:async()=>{}});assert.equal(count,1);});
