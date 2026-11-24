// Vercel serverless function: read-only proxy to the requisition tracker sheet.
//
// Env vars (Vercel > Project > Settings > Environment Variables):
//   TRACKER_URL  – the Apps Script web-app URL (…/exec)
//   TRACKER_KEY  – the same key pasted into google-apps-script/Code.gs
// The key never reaches the browser. Callers must send the id of a real app
// user (x-bty-user header), checked against Firestore `users/{id}`.

const PROJECT = 'bty-accounting-app-2'
const API_KEY = 'AIzaSyC_KnyjQcD-tB97063XFj2TbWaQ6djAR9U' // public Firebase web key (already in src/firebase.js)

async function isAppUser(id) {
  if (!id || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) return false
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${encodeURIComponent(id)}?key=${API_KEY}&mask.fieldPaths=username`
  const r = await fetch(url)
  return r.ok
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const { TRACKER_URL, TRACKER_KEY } = process.env
  if (!TRACKER_URL || !TRACKER_KEY) {
    return res.status(503).json({ error: 'not_configured' })
  }

  try {
    if (!(await isAppUser(req.headers['x-bty-user']))) {
      return res.status(401).json({ error: 'unauthorized' })
    }

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
