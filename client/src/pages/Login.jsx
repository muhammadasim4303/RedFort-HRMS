import React, { useState } from "react";
import { api, setAuthToken, setUser } from "../api";
import { Lock, Mail, ShieldAlert, LogIn, Sun, Moon } from "lucide-react";

export default function Login({ onLogin, theme, toggleTheme }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await api.login(email, password);
            setAuthToken(data.token);
            setUser(data.user);
            onLogin(data.user);
        } catch (err) {
            setError(err.message || "Failed to log in. Please check credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-theme-canvas text-theme-body transition-colors duration-300">
            {/* Theme Toggle Button floating in top-right */}
            <div className="absolute top-6 right-6 z-20 animate-slide-up">
                <button 
                    onClick={toggleTheme}
                    className="p-2.5 border border-theme-border rounded-xl text-theme-muted hover:text-theme-h hover:bg-theme-card transition-all cursor-pointer bg-theme-card/30 shadow-md backdrop-blur-sm"
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>

            {/* Ambient Background Glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-red/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md z-10 animate-slide-up">
                {/* Branding Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-theme-card border border-theme-border flex items-center justify-center mb-4 shadow-lg shadow-primary-red/5 p-2 overflow-hidden">
                        <img src="/RFT360 Logo.png" alt="RFT360 Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-display font-bold tracking-tight text-theme-h m-0">
                        Red<span className="text-primary-red">Fort</span> HRMS
                    </h1>
                    <p className="text-theme-muted mt-2 text-sm font-sans">Human Resource & Geofenced Attendance</p>
                </div>

                {/* Login Glass Panel */}
                <div className="glass-panel p-8">
                    <h2 className="text-xl font-semibold text-theme-h mb-6 text-center font-display">Portal Access</h2>

                    {error && (
                        <div className="mb-6 p-4 bg-danger-bg border border-danger-border text-danger-rose rounded-xl text-sm flex items-start gap-3 animate-pulse-ring">
                            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Corporate Email</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-theme-muted">
                                    <Mail className="w-5 h-5" />
                                </span>
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    className="glass-input pl-12 pr-4 text-sm"
                                    placeholder="name@redfort.com"
                                    required 
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Secure Password</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-theme-muted">
                                    <Lock className="w-5 h-5" />
                                </span>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    className="glass-input pl-12 pr-4 text-sm"
                                    placeholder="••••••••"
                                    required 
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-primary-red hover:bg-primary-red-hover disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-primary-red/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>Sign In to Workspace</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center text-xs text-theme-muted font-sans">
                    &copy; 2026 RedFort Projects. All rights reserved.
                </div>
            </div>
        </div>
    );
}
