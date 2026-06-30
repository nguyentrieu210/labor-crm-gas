// Refresh access_token cho clasp v2 qua Node (mạng ổn định hơn clasp/undici).
const fs = require('fs'), os = require('os'), path = require('path');
const RC = path.join(os.homedir(), '.clasprc.json');
const rc = JSON.parse(fs.readFileSync(RC, 'utf8'));
const cs = rc.oauth2ClientSettings || {};
const refresh = rc.token && rc.token.refresh_token;
if (!refresh) { console.log('NO refresh_token'); process.exit(1); }

async function tryRefresh(attempt) {
  const body = new URLSearchParams({
    client_id: cs.clientId, client_secret: cs.clientSecret,
    refresh_token: refresh, grant_type: 'refresh_token'
  });
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const t = await r.json();
    if (t.error || !t.access_token) { console.log('ERR', JSON.stringify(t)); return false; }
    rc.token.access_token = t.access_token;
    rc.token.token_type = t.token_type || 'Bearer';
    if (t.scope) rc.token.scope = t.scope;
    if (t.id_token) rc.token.id_token = t.id_token;
    rc.token.expiry_date = Date.now() + (Number(t.expires_in || 3600) * 1000);
    fs.writeFileSync(RC, JSON.stringify(rc, null, 2));
    console.log('REFRESHED ok, expires in', t.expires_in, 's');
    return true;
  } catch (e) {
    console.log('attempt', attempt, 'failed:', e.message, e.cause && e.cause.message);
    return false;
  }
}

(async () => {
  for (let i = 1; i <= 6; i++) {
    if (await tryRefresh(i)) process.exit(0);
  }
  console.log('ALL ATTEMPTS FAILED');
  process.exit(1);
})();
