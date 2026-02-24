'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';

export default function AuthScreen() {
  const router = useRouter();
  const { login: authLogin, isLoggedIn, isLoading: isAuthLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if already logged in
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const API_BASE_URL = 'http://localhost:5000/api';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear errors when user types
    setServerError(null);
    setSuccessMessage(null);
  };

  const isFieldValid = (name: string) => {
    if (!showErrors) return true;
    const value = formData[name as keyof typeof formData];
    if (name === 'confirmPassword' && isSignUp) {
      return value === formData.password && value !== '';
    }
    return value.trim() !== '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    setServerError(null);
    setSuccessMessage(null);
    
    const requiredFields = isSignUp 
      ? ['fullName', 'username', 'email', 'password', 'confirmPassword']
      : ['email', 'password'];
    
    const allFilled = requiredFields.every(field => formData[field as keyof typeof formData].trim() !== '');
    const passwordsMatch = isSignUp ? formData.password === formData.confirmPassword : true;

    if (allFilled && passwordsMatch) {
      setIsLoading(true);
      try {
        const endpoint = isSignUp ? '/auth/signup' : '/auth/login';
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(isSignUp ? {
            fullName: formData.fullName,
            username: formData.username,
            email: formData.email,
            password: formData.password
          } : {
            email: formData.email,
            password: formData.password
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Something went wrong');
        }

        setSuccessMessage(isSignUp ? 'Registration successful! You can now sign in.' : 'Login successful!');
        if (!isSignUp) {
          // Store session in global context
          authLogin({ 
            user: {
              id: data.user.id,
              email: data.user.email,
              fullName: data.user.user_metadata?.full_name,
              username: data.user.user_metadata?.username
            }, 
            session: data.session 
          });
          
          // Redirect to home after 1.5s
          setTimeout(() => {
            router.push('/');
          }, 1500);
        } else {
          // Switch to sign in after successful signup
          setTimeout(() => setIsSignUp(false), 2000);
        }
      } catch (error: any) {
        setServerError(error.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Redirect if already logged in
  React.useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, isAuthLoading, router]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#050B18] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-olos-blue/30 border-t-olos-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoggedIn) return null;
  
  return (
    <div className="min-h-screen bg-[#050B18] text-white selection:bg-olos-blue/30 overflow-y-auto pb-12">
      <Navbar />
      
      <div className="flex flex-col items-center justify-center pt-32 px-4 md:px-8">
        {/* Auth Bordered Card */}
        <div className="w-full max-w-[800px] border border-white/10 rounded-[40px] bg-[#0B1121]/30 backdrop-blur-xl p-8 md:p-16 flex flex-col items-center animate-fade-in">
          
          {/* Header Inside Card */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-[#3B82F6] tracking-tighter uppercase mb-2">OLOS</h1>
            <p className="text-gray-400 text-sm font-medium">Create an account and challenge real players.</p>
          </div>

          <div className="w-full max-w-[450px] space-y-8">
            {/* Mode Switcher */}
            <div className="w-full flex p-1 bg-[#1A232E] rounded-xl border border-[#2B3945]">
              <button 
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setShowErrors(false);
                }}
                className={`flex-1 py-3 rounded-lg text-sm font-bold border-2 transition-all duration-300 ${!isSignUp ? 'bg-[#050B18] border-[#3B82F6] text-white shadow-xl' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setShowErrors(false);
                }}
                className={`flex-1 py-3 rounded-lg text-sm font-bold border-2 transition-all duration-300 ${isSignUp ? 'bg-[#050B18] border-[#3B82F6] text-white shadow-xl' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-6">
              {serverError && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm font-medium animate-shake">
                  {serverError}
                </div>
              )}
              {successMessage && (
                <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-500 text-sm font-medium">
                  {successMessage}
                </div>
              )}

              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-white block">Full Name</label>
                    <input 
                      type="text" 
                      name="fullName"
                      disabled={isLoading}
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="John Doe" 
                      className={`w-full h-12 bg-black border ${!isFieldValid('fullName') ? 'border-red-500' : 'border-[#3B82F6]/30'} rounded-xl px-4 text-sm text-gray-300 focus:outline-none focus:border-[#3B82F6] transition-all disabled:opacity-50`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-white block">Username</label>
                    <input 
                      type="text" 
                      name="username"
                      disabled={isLoading}
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="johndoe123" 
                      className={`w-full h-12 bg-black border ${!isFieldValid('username') ? 'border-red-500' : 'border-[#3B82F6]/30'} rounded-xl px-4 text-sm text-gray-300 focus:outline-none focus:border-[#3B82F6] transition-all disabled:opacity-50`}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-white block">Email</label>
                <input 
                  type="email" 
                  name="email"
                  disabled={isLoading}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="player@example.com" 
                  className={`w-full h-12 bg-black border ${!isFieldValid('email') ? 'border-red-500' : 'border-[#3B82F6]/30'} rounded-xl px-4 text-sm text-gray-300 focus:outline-none focus:border-[#3B82F6] transition-all disabled:opacity-50`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-white block">Password</label>
                <input 
                  type="password" 
                  name="password"
                  disabled={isLoading}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="********" 
                  className={`w-full h-12 bg-black border ${!isFieldValid('password') ? 'border-red-500' : 'border-[#3B82F6]/30'} rounded-xl px-4 text-sm text-gray-300 focus:outline-none focus:border-[#3B82F6] transition-all disabled:opacity-50`}
                />
                {isSignUp && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
                    <ValidationItem met={formData.password.length >= 8} label="8+ Digits" />
                    <ValidationItem met={/[A-Z]/.test(formData.password)} label="Uppercase" />
                    <ValidationItem met={/[a-z]/.test(formData.password)} label="Lowercase" />
                    <ValidationItem met={/[0-9]/.test(formData.password)} label="Number" />
                    <ValidationItem met={/[^A-Za-z0-9]/.test(formData.password)} label="Special" />
                  </div>
                )}
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white block">Confirm Password</label>
                  <input 
                    type="password" 
                    name="confirmPassword"
                    disabled={isLoading}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="********" 
                    className={`w-full h-12 bg-black border ${!isFieldValid('confirmPassword') ? 'border-red-500' : 'border-[#3B82F6]/30'} rounded-xl px-4 text-sm text-gray-300 focus:outline-none focus:border-[#3B82F6] transition-all disabled:opacity-50`}
                  />
                  {formData.confirmPassword && (
                    <div className="mt-2 px-1">
                      <ValidationItem met={formData.password === formData.confirmPassword && formData.password !== ''} label="Passwords Match" />
                    </div>
                  )}
                </div>
              )}

              {!isSignUp && (
                <div className="flex justify-end">
                  <button type="button" disabled={isLoading} className="text-xs font-bold text-gray-500 hover:text-white transition-colors disabled:opacity-50">Forgot Password?</button>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-14 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  isSignUp ? 'Sign Up' : 'Sign In'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest whitespace-nowrap opacity-80">Or continue with</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Social Logins */}
            <div className="flex items-center justify-center gap-8">
              <button className="flex items-center gap-3 text-sm font-bold text-white hover:opacity-80 transition-all">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button className="flex items-center gap-3 text-sm font-bold text-white hover:opacity-80 transition-all">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M17.05 20.28c-.96.95-2.18 1.78-3.41 1.78-1.51 0-2.08-.94-3.9-.94-1.83 0-2.45.92-3.87.92-1.2 0-2.62-1.12-3.53-2.44-1.78-2.58-1.98-6.16-.76-8.23.6-1.02 1.67-1.68 2.82-1.7 1.07-.02 2.06.71 2.7.71.65 0 1.95-.88 3.25-.75 1.34.02 2.45.69 3.12 1.67-2.81 1.66-2.35 5.48.5 6.78-.65 1.55-1.53 3.14-2.42 4.01l-.5.5zm-3.08-16.12c.56-.68.94-1.62.83-2.58-.88.04-1.94.6-2.58 1.34-.58.67-1.07 1.64-.94 2.56.98.08 1.96-.5 2.69-1.32z"/>
                </svg>
                Apple
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValidationItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 transition-all duration-300">
      <div className={`w-1 h-1 rounded-full transition-colors ${met ? 'bg-[#3B82F6]' : 'bg-white/10'}`} />
      <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${met ? 'text-[#3B82F6]' : 'text-gray-600'}`}>
        {label}
      </span>
    </div>
  );
}
