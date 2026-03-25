'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Mail, Lock, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const[isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('') // Clear previous errors

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError

      // Check Role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      if (profileError) throw profileError

      // Redirect based on role
      if (profile?.role === 'admin') {
        router.replace('/admin')
      } else if (profile?.role === 'driver') {
        router.replace('/driver')
      } else {
        router.replace('/client')
      }
    } catch (err: any) {
      setError(err.message || "Invalid login credentials.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white font-sans">
      
      {/* Left Side: The Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:w-[50%] xl:w-[40%] 2xl:w-[35%] lg:px-20 xl:px-24 border-r border-slate-200">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          
          {/* Logo / Branding */}
          <div className="flex items-center gap-2 text-slate-900 mb-10">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-md shadow-indigo-200">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight">Accident<span className="text-indigo-600">Monitor</span></span>
          </div>

          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500 font-medium">Please enter your credentials to access your dashboard.</p>
          </div>

          <div className="mt-10">
            <form onSubmit={handleLogin} className="space-y-6">
              
              {/* Error Message Alert */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl flex items-start gap-3 animate-in fade-in duration-300">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                  <input 
                    type="email" 
                    required 
                    placeholder="name@company.com"
                    className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white font-bold text-sm py-4 px-6 rounded-xl hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:bg-indigo-400 group mt-2"
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin h-5 w-5" /> Authenticating...</>
                ) : (
                  <>Sign In Securely <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          </div>
          
          <p className="text-center text-xs font-medium text-slate-400 mt-10">
            Concept core &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* Right Side: Visual / Branding Panel */}
      <div className="hidden lg:flex flex-1 relative bg-slate-900 items-center justify-center overflow-hidden">
        {/* Abstract Background Design */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-400 via-slate-900 to-slate-900" />
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[30rem] h-[30rem] rounded-full bg-blue-600/10 blur-3xl" />
        
        <div className="relative z-10 w-full max-w-lg px-8 flex flex-col items-center text-center">
          <div className="h-24 w-24 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center mb-8 shadow-2xl">
            <ShieldCheck className="h-12 w-12 text-indigo-400" />
          </div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-6">
            Centralized Accident Data Intelligence.
          </h2>
          <p className="text-lg text-slate-300 font-medium leading-relaxed">
            Monitor incidents in real-time. Securely upload and access dashcam footage, vehicle forensics, and driver logs all from one encrypted command center.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-6 w-full text-left">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-5 rounded-2xl">
              <h4 className="text-indigo-300 font-bold mb-1">Military-Grade</h4>
              <p className="text-sm text-slate-400 font-medium">Row-level security protecting your data</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-5 rounded-2xl">
              <h4 className="text-indigo-300 font-bold mb-1">Instant Access</h4>
              <p className="text-sm text-slate-400 font-medium">Real-time media streaming & analytics</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}