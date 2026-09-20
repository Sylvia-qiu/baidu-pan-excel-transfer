const fs=require('node:fs');const path=require('node:path');
const {version}=require('./package.json');
const header=`// ==UserScript==
// @name         百度网盘 Excel 转存与换链助手
// @namespace    local.pan-excel-assistant
// @version      ${version}
// @author       Sylvia-qiu
// @homepageURL  https://github.com/Sylvia-qiu/baidu-pan-excel-transfer
// @supportURL   https://github.com/Sylvia-qiu/baidu-pan-excel-transfer/issues
// @downloadURL  https://raw.githubusercontent.com/Sylvia-qiu/baidu-pan-excel-transfer/main/baidu-pan-excel-transfer.user.js
// @updateURL    https://raw.githubusercontent.com/Sylvia-qiu/baidu-pan-excel-transfer/main/baidu-pan-excel-transfer.user.js
// @description  Excel逐行建目录、转存、生成365天分享并导出独立转存链接列；保存进度，验证分享内容。
// @match        https://pan.baidu.com/disk/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==
// Derived workflow: aitippro/baidu-pan-batch-transfer (MIT).
// Bundles ExcelJS 4.4.0 (MIT); see accompanying license files.
`;
const files=['vendor/exceljs.min.js','core.js','api.js','app.js'];
const licenses=['LICENSE','LICENSE-upstream.txt','LICENSE-exceljs.txt'].map(f=>'/* '+f+'\n'+fs.readFileSync(path.join(__dirname,f),'utf8')+'\n*/').join('\n');
const output=header+'\n'+licenses+'\n'+files.map(f=>fs.readFileSync(path.join(__dirname,f),'utf8').replaceAll('__PAN_VERSION__',version).replace(/\r\n/g,'\n')).join('\n;\n');
fs.writeFileSync(path.join(__dirname,'baidu-pan-excel-transfer.user.js'),output.replace(/\r\n/g,'\n')); 
console.log('Built baidu-pan-excel-transfer.user.js ('+Buffer.byteLength(output)+' bytes)');
