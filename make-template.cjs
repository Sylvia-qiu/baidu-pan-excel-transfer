const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('./vendor/exceljs.min.js');
(async () => {
  const workbook = require('./core.js').createTemplate(ExcelJS);
  fs.mkdirSync(path.join(__dirname, 'examples'), {recursive: true});
  fs.writeFileSync(path.join(__dirname, 'examples/import-template.xlsx'), Buffer.from(await workbook.xlsx.writeBuffer()));
  console.log('Created example template examples/import-template.xlsx');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
