const {test}=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('./vendor/exceljs.min.js');
const C=require('./core.js');
test('downloaded teaching example is skipped and exports with a blank result',async()=>{
 const w=C.createTemplate(ExcelJS),s=w.worksheets[0];
 assert.equal(s.getCell('A2').text,'教学示例（不处理）');
 assert.equal(C.importTasks(w).tasks.length,0);
 s.addRow([1,'https://pan.baidu.com/s/1real','/资源/真实任务','真实备注']);
 const bytes=await w.xlsx.writeBuffer(),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes);
 const tasks=C.importTasks(loaded).tasks;assert.equal(tasks.length,1);assert.equal(tasks[0].row,3);assert.equal(tasks[0].source.key,'real');
 const out=new ExcelJS.Workbook();await out.xlsx.load(await C.exportResults(bytes,{'导入模板:3':{phase:'done',link:'https://pan.baidu.com/s/1NEW?pwd=abcd'}},ExcelJS));
 assert.equal(out.worksheets[0].getCell('C2').text,'');assert.match(out.worksheets[0].getCell('C3').text,/1NEW/);
 assert.equal(out.worksheets[0].getCell('A2').text,'教学示例（不处理）');
 s.spliceRows(2,1);assert.equal(C.importTasks(w).tasks[0].row,2);
});
test('four-column template imports row identities, rich links and calculated paths',async()=>{
 const w=C.createTemplate(ExcelJS,{example:false}),s=w.getWorksheet('导入模板');
 assert.deepEqual(s.getRow(1).values.slice(1),['序号','原始链接','转存路径','备注']);
 s.addRow([7,{hyperlink:'https://pan.baidu.com/s/1abc',text:{richText:[{text:'提取码：abcd'}]}},{formula:'"/资源/甲?"',result:'/资源/甲?'},'备注']);
 s.addRow([9,'无效链接','/资源/乙','保留']);
 const copy=new ExcelJS.Workbook();await copy.xlsx.load(await w.xlsx.writeBuffer());
 const {tasks}=C.importTasks(copy);assert.equal(tasks.length,2);assert.equal(tasks[0].key,'导入模板:2');
 assert.equal(tasks[0].source.pwd,'abcd');assert.equal(tasks[0].target,'/资源/甲？');assert.ok(tasks[0].pathNotice);assert.ok(tasks[1].error);
});
test('export has exactly five columns, preserves values and blanks unsuccessful links',async()=>{
 const w=C.createTemplate(ExcelJS,{example:false}),s=w.worksheets[0];
 s.addRow([1,'https://pan.baidu.com/s/1abc','/资源/甲','备注一']);
 s.addRow([2,'https://pan.baidu.com/s/1def','/资源/乙','备注二']);
 s.addRow([3,'https://pan.baidu.com/s/1ghi','/资源/丙','备注三']);
 const out=new ExcelJS.Workbook();await out.xlsx.load(await C.exportResults(await w.xlsx.writeBuffer(),{'导入模板:2':{phase:'done',link:'https://pan.baidu.com/s/1NEW?pwd=abcd'},'导入模板:3':{phase:'share-created',link:'不应导出',error:'核验失败'}},ExcelJS));
 const result=out.worksheets[0];assert.equal(result.columnCount,5);
 assert.deepEqual(result.getRow(1).values.slice(1),['序号','原始链接','转存链接','转存路径','备注']);
 assert.equal(result.getCell('C2').text,'https://pan.baidu.com/s/1NEW?pwd=abcd');
 for(const row of [3,4])assert.equal(result.getCell(row,3).text,'');
 for(let r=2;r<=4;r++)for(const [before,after] of [[1,1],[2,2],[3,4],[4,5]])assert.deepEqual(result.getCell(r,after).value,s.getCell(r,before).value);
 assert.throws(()=>C.importTasks(out),/四列模板/);
});
test('old seven-column template is rejected with a new-template instruction',()=>{
 const w=new ExcelJS.Workbook();w.addWorksheet('旧表').addRow(['原始链接','转存路径','重命名','备注','剧名','试看链接','序号']);
 assert.throws(()=>C.importTasks(w),/四列模板/);
});
test('extra text columns are ignored during processing and preserved after insertion',async()=>{
 const w=C.createTemplate(ExcelJS,{example:false}),s=w.worksheets[0];
 s.getCell('E1').value='负责人';s.getCell('F1').value='补充说明';s.getCell('G1').value='转存链接';
 s.addRow([1,'https://pan.baidu.com/s/1abc','/资源/甲','备注','张三','https://pan.baidu.com/s/1OTHER','用户自填文字']);
 s.getCell('F2').font={bold:true};s.getColumn(6).width=42;
 s.addRow(['','','','','只填写附加列的一行','保留换行\n内容','']);
 const tasks=C.importTasks(w).tasks;assert.equal(tasks.length,1);assert.equal(tasks[0].source.key,'abc');
 const out=new ExcelJS.Workbook();await out.xlsx.load(await C.exportResults(await w.xlsx.writeBuffer(),{},ExcelJS));
 const result=out.worksheets[0];assert.equal(result.columnCount,8);
 for(let row=1;row<=3;row++)for(let col=4;col<=7;col++)assert.deepEqual(result.getCell(row,col+1).value,s.getCell(row,col).value);
 assert.equal(result.getCell('G2').font.bold,true);assert.equal(result.getColumn(7).width,42);
 assert.equal(result.getCell('C2').text,'');
});
