// Vercel serverless function: the app's only door to the requisition tracker sheet.
//   GET  → read the sheet (requests, receipts, reconciliation, dropdown lists…)
//   POST → write a requisition entry into the sheet (new request, processing,
//          sent to bank, bank-statement matching, release, liquidation,
//          receipt). The sheet is the database.
//
// Env vars (Vercel > Project > Settings > Environment Variables):
//   TRACKER_URL  – the Apps Script web-app URL (…/exec)
//   TRACKER_KEY  – the same key as TRACKER_KEY in google-apps-script/Code.gs
// The key never reaches the browser. Callers must send the id of a real app
// user (x-bty-user header), checked against Firestore `users/{id}`; that
// user's username is recorded in the sheet's APP LOG for every write.

const PROJECT = 'bty-accounting-app-2'
const API_KEY = 'AIzaSyC_KnyjQcD-tB97063XFj2TbWaQ6djAR9U' // public Firebase web key (already in src/firebase.js)

async function appUser(id) {
  if (!id || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) return null
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${encodeURIComponent(id)}?key=${API_KEY}&mask.fieldPaths=username&mask.fieldPaths=role`
  const r = await fetch(url)
  if (!r.ok) return null
  const doc = await r.json()
  return {
    username: doc?.fields?.username?.stringValue || id,
    role: doc?.fields?.role?.stringValue || 'user',
  }
}

const ACTIONS = new Set(['addRequest', 'updateRequest', 'addReceipt', 'markSent', 'markNotApproved', 'proposeMatches', 'applyMatches'])
const STEPS = new Set(['request', 'process', 'release', 'liquidate'])

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const { TRACKER_URL, TRACKER_KEY } = process.env
  if (!TRACKER_URL || !TRACKER_KEY) {
    return res.status(503).json({ error: 'not_configured' })
  }

  try {
    const user = await appUser(req.headers['x-bty-user'])
    if (!user) return res.status(401).json({ error: 'unauthorized' })

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      const { action, step, data } = body
      if (!ACTIONS.has(action) || (action === 'updateRequest' && !STEPS.has(step)) || typeof data !== 'object' || !data) {
        return res.status(400).json({ error: 'bad_request' })
      }
      const r = await fetch(TRACKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: TRACKER_KEY, user: user.username, action, step, data }),
        redirect: 'follow',
      })
      const text = await r.text()
      let out
      try { out = JSON.parse(text) } catch {
        return res.status(502).json({ error: 'bad_sheet_response' })
      }
      if (out.error) return res.status(out.error === 'invalid' ? 422 : 502).json(out)
      return res.status(200).json(out)
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

    const fresh = req.query && req.query.fresh === '1' ? '&fresh=1' : ''
    const r = await fetch(`${TRACKER_URL}?key=${encodeURIComponent(TRACKER_KEY)}${fresh}`, { redirect: 'follow' })
    const text = await r.text()
    let data
    try { data = JSON.parse(text) } catch {
      return res.status(502).json({ error: 'bad_sheet_response' })
    }
    if (data.error) return res.status(502).json({ error: `sheet_${data.error}` })
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: 'sheet_unreachable' })
  }
}
