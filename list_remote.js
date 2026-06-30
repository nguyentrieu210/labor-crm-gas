const fs = require('fs'), os = require('os'), path = require('path');
const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.clasprc.json'), 'utf8'));
const token = rc.token.access_token;
const SID = '1Zvm7erGEbr43jG8oW60GWwvC6qx86hErjcmJPPycaYm-DFK6_-b7DBtG';
const url = 'https://script.googleapis.com/v1/projects/' + SID + '/content';

async function go(attempt) {
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const j = await r.json();
    if (j.error) { console.log('API ERROR', JSON.stringify(j.error).slice(0, 300)); return false; }
    console.log('REMOTE FILES (' + j.files.length + '):');
    j.files.forEach(f => console.log('  ', f.type.padEnd(10), f.name, '(' + (f.source ? f.source.length : 0) + ' chars)'));
    const has = j.files.some(f => f.name === '11_Jobs');
    console.log('\n>>> 11_Jobs CÓ trên remote?', has ? 'CÓ ✓' : 'KHÔNG ✗');
    return true;
  } catch (e) {
    console.log('attempt', attempt, 'failed:', e.message);
    return false;
  }
}
(async () => { for (let i = 1; i <= 8; i++) { if (await go(i)) return; } })();
