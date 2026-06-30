// Đẩy toàn bộ file lên Apps Script qua API (thay clasp, retry chắc chắn).
const fs = require('fs'), os = require('os'), path = require('path');
const DIR = 'C:/Users/Admin/Documents/exel/AppsScript/labor_crm_gas';
const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.clasprc.json'), 'utf8'));
const token = rc.token.access_token;
const SID = '1Zvm7erGEbr43jG8oW60GWwvC6qx86hErjcmJPPycaYm-DFK6_-b7DBtG';

const files = [];
// manifest trước
files.push({ name: 'appsscript', type: 'JSON', source: fs.readFileSync(path.join(DIR, 'appsscript.json'), 'utf8') });
fs.readdirSync(DIR).sort().forEach(fn => {
  const full = path.join(DIR, fn);
  if (fn.endsWith('.gs')) files.push({ name: fn.slice(0, -3), type: 'SERVER_JS', source: fs.readFileSync(full, 'utf8') });
  else if (fn.endsWith('.html')) files.push({ name: fn.slice(0, -5), type: 'HTML', source: fs.readFileSync(full, 'utf8') });
});
console.log('Đẩy', files.length, 'file:', files.map(f => f.name).join(', '));

const url = 'https://script.googleapis.com/v1/projects/' + SID + '/content';
const body = JSON.stringify({ files: files });

async function put(attempt) {
  try {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body
    });
    const j = await r.json();
    if (j.error) { console.log('API ERROR', JSON.stringify(j.error).slice(0, 500)); return false; }
    console.log('>>> PUSHED OK — remote giờ có', j.files.length, 'file.');
    console.log('>>> 11_Jobs:', j.files.some(f => f.name === '11_Jobs') ? 'CÓ ✓' : 'KHÔNG ✗',
      '| 99_Migration:', j.files.some(f => f.name === '99_Migration') ? 'CÓ ✓' : 'KHÔNG ✗');
    return true;
  } catch (e) {
    console.log('attempt', attempt, 'lỗi:', e.message, e.cause && e.cause.message);
    return false;
  }
}
(async () => { for (let i = 1; i <= 12; i++) { if (await put(i)) return; } console.log('TẤT CẢ THẤT BẠI'); })();
