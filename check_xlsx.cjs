const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

try {
  const filePath = path.join(process.cwd(), 'hymnal_master_data.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  console.log('--- EXCEL DATA CHECK ---');
  console.log('Total Rows:', data.length);
  if (data.length > 0) {
    console.log('Headers (Keys):', Object.keys(data[0]));
    // 41번 곡 찾기
    const song41 = data.find(r => r['장'] == 41 || r['번호'] == 41 || r['number'] == 41);
    console.log('Song 41 Data:', JSON.stringify(song41, null, 2));
  }
} catch (err) {
  console.error('Error:', err);
}
