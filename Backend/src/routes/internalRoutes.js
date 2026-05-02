const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Protected health check. Set INTERNAL_DEBUG_TOKEN in the environment and
// provide it as header 'x-internal-token' when calling this endpoint.
router.get('/supabase-health', async (req, res) => {
  const token = req.headers['x-internal-token'];
  if (!process.env.INTERNAL_DEBUG_TOKEN) {
    return res.status(500).json({ success: false, message: 'Internal debug token not configured on server' });
  }

  if (!token || token !== process.env.INTERNAL_DEBUG_TOKEN) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    // Perform a harmless select to verify Supabase connectivity (requires read access)
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      console.error('[Internal] Supabase health check error:', error);
      return res.status(502).json({ success: false, message: 'Supabase call failed', details: error.message });
    }

    return res.json({ success: true, message: 'Supabase reachable', sampleRows: (data || []).length });
  } catch (err) {
    console.error('[Internal] Supabase health exception:', err);
    return res.status(500).json({ success: false, message: 'Exception during health check' });
  }
});

module.exports = router;
