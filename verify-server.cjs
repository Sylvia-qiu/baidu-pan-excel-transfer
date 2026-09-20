const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const E=require('./vendor/exceljs.min.js');
const dirs=new Map([['/',[]],['/测试',[{fs_id:88,server_filename:'已有其他文件.txt',path:'/测试/已有其他文件.txt',isdir:0,size:1,md5:'unrelated'}]]]);
const source={fs_id:11,server_filename:'01.mp4',path:'/source/01.mp4',isdir:0,size:100,md5:'abc'};let record=null;const mutations=[];
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><title>本地功能验证</title><body style="background:#f1f5f9"><h1>本地验证：不连接真实网盘</h1><script>window.GM_setValue=(k,v)=>localStorage.setItem(k,v);window.GM_getValue=(k,d)=>localStorage.getItem(k)??d;</script><script src="/vendor/exceljs.min.js"></script><script src="/core.js"></script><script src="/api.js"></script><script src="/app.js"></script></body></html>`;
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');const p=url.pathname;let body='';for await(const chunk of req)body+=chunk;const form=new URLSearchParams(body);
 const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(p==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
 if(['/core.js','/api.js','/app.js','/vendor/exceljs.min.js'].includes(p)){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(__dirname,p)));}
 if(p==='/fixture.xlsx'){const w=new E.Workbook();const s=w.addWorksheet('导入模板');s.addRow(['序号','原始链接','转存路径','备注']);s.addRow([1,'通过网盘分享的文件：01.mp4\n链接：https://pan.baidu.com/s/1fixture 提取码：abcd','/测试/新目录/剧名','测试备注']);res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');return res.end(Buffer.from(await w.xlsx.writeBuffer()));}
 if(p==='/api/gettemplatevariable')return json({errno:0,result:{bdstoken:'fixture-token',uk:12345}});
 if(p==='/api/list'){const list=dirs.get(url.searchParams.get('dir'));return json(list?{errno:0,list}:{errno:-9});}
 if(p==='/api/create'){dirs.set(form.get('path'),[]);mutations.push({type:'mkdir',path:form.get('path')});return json({errno:0});}
 if(p==='/share/verify')return json({errno:0,randsk:'fixture%2B%2F%3D'});
 if(p==='/s/1fixture'){res.setHeader('Content-Type','text/html');return res.end('<script>locals.mset('+JSON.stringify({shareid:100,share_uk:200,errno:0,errortype:-1,...(process.env.PAN_TEST_SEKEY?{}:{file_list:[source]})})+');</script>');}
 if(p==='/share/list')return json(process.env.PAN_TEST_SEKEY&&url.searchParams.get('sekey')==='fixture+/='&&url.searchParams.get('is_from_web')==='true'?{errno:0,list:[source]}:{errno:-9});
 if(p==='/share/transfer'&&process.env.PAN_TEST_SEKEY&&url.searchParams.get('sekey')!=='fixture+/=')return json({errno:-9});
 if(p==='/share/transfer'){const dest=form.get('path');dirs.get(dest).push({...source,fs_id:99,path:dest+'/01.mp4'});mutations.push({type:'transfer',path:dest,ids:JSON.parse(form.get('fsidlist'))});return json({errno:0,extra:{list:[{from:'/source/01.mp4',to:dest+'/01.mp4',from_fs_id:11,to_fs_id:99}]}});}
 if(p==='/share/set'){const ids=JSON.parse(form.get('fid_list'));mutations.push({type:'share',ids,period:form.get('period')});record={shareId:999,fsIds:ids,expiredTime:Math.floor(Date.now()/1000)+365*86400,status:0};return json({errno:0,shareid:999,link:'https://pan.baidu.com/s/1LOCALTEST'});}
 if(p==='/share/record')return json({errno:0,list:record?[record]:[]});
 if(p==='/evidence')return json({mutations});
 res.statusCode=404;res.end('not found');
 }catch(e){res.statusCode=500;res.end(e.message);}}).listen(8597,'127.0.0.1',()=>console.log('Local mock verification server: 8597'));
