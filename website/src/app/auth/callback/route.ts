import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // If provider returned an error
  if (error) {
    console.error('[OAuth Callback] Provider error:', error);
    return NextResponse.redirect(`${origin}/auth?error=oauth_failed`);
  }

  if (code) {
    // Create a Supabase client scoped to this server request
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[OAuth Callback] Code exchange failed:', exchangeError.message);
      return NextResponse.redirect(`${origin}/auth?error=oauth_failed`);
    }

    // Success — redirect to home; AuthContext.onAuthStateChange will pick up the session
    return NextResponse.redirect(`${origin}/`);
  }

  // No code — something unexpected happened
  return NextResponse.redirect(`${origin}/auth?error=oauth_failed`);
}
