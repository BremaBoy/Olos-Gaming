const supabase = require('../config/supabase');

const signup = async (req, res) => {
  const { email, password, fullName, username } = req.body;

  try {
    // 1. Sign up user in Supabase Auth
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: username,
        }
      }
    });

    if (authError) throw authError;

    // 2. Insert into profiles table (optional but recommended)
    // You might need to create this table in Supabase SQL Editor first
    /*
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        { id: data.user.id, full_name: fullName, username: username, email: email }
      ]);
    
    if (profileError) {
       console.error('Error creating profile:', profileError);
       // We might want to delete the auth user if profile creation fails?
    }
    */

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName,
        username
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      session: data.session,
      user: data.user
    });
  } catch (error) {
    const errorMsg = error.message || '';
    console.error('[Backend] Login error details:', {
      message: errorMsg,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    
    res.status(401).json({
      success: false,
      message: errorMsg.toLowerCase().includes('fetch failed') 
        ? 'Backend Connectivity Error: Render cannot reach Supabase. Check your Supabase URL in Render settings.' 
        : (errorMsg || 'Login failed'),
      debug: { 
        hint: 'This error happened on the Render backend server.',
        originalError: errorMsg
      }
    });
  }
};

module.exports = {
  signup,
  login
};
