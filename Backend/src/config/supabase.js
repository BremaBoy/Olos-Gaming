const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for backend operations

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
