import React, { useState, useEffect } from "react";
import { api, clearAuth } from "../api";
import { 
    UserPlus, Mail, Lock, Shield, Tag, UserCheck, 
    LogOut, RefreshCw, AlertTriangle, ShieldCheck, 
    Sparkles, KeyRound, Briefcase, Sun, Moon
} from "lucide-react";

export default function AdminDashboard({ theme, toggleTheme }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState(2); // default Employee (2)
    const [department, setDepartment] = useState("");
    const [managerId, setManagerId] = useState("");
    
    const [managers, setManagers] = useState([]);
    
    // Toast and Loaders
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingManagers, setLoadingManagers] = useState(false);

    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
        }, 5000);
    };

    const fetchManagers = async () => {
        setLoadingManagers(true);
        try {
            const employees = await api.getEmployees();
            // Filter users who are LineManagers (role = 1) or SuperAdmins (role = 0)
            const managersList = employees.filter(e => e.role === "LineManager" || e.role === 1);
            setManagers(managersList);
        } catch (err) {
            console.error("Failed to load managers:", err);
            showToast("Failed to populate manager hierarchy.", "error");
        } finally {
            setLoadingManagers(false);
        }
    };

    useEffect(() => {
        fetchManagers();
    }, []);

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.register({
                email,
                password,
                fullName,
                role: parseInt(role),
                department,
                managerId: managerId ? managerId : null
            });
            showToast(`Registered account for ${fullName}!`, "success");
            setEmail("");
            setPassword("");
            setFullName("");
            setDepartment("");
            setManagerId("");
            fetchManagers(); // refresh potential manager list if a new manager was registered
        } catch (err) {
            showToast(err.message || "Failed to register user.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        clearAuth();
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-theme-canvas text-theme-body flex flex-col transition-colors duration-300">
            {/* Custom Toast Banner */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 transition-all duration-300 animate-slide-up max-w-sm ${
                    toast.type === "success" ? "bg-success-bg border-success-border text-success-green" :
                    toast.type === "error" ? "bg-danger-bg border-danger-border text-danger-rose" :
                    "bg-info-bg border-info-border text-info-blue"
                }`}>
                    {toast.type === "success" && <ShieldCheck className="w-5 h-5 shrink-0" />}
                    {toast.type === "error" && <AlertTriangle className="w-5 h-5 shrink-0" />}
                    <div className="text-sm font-medium">{toast.message}</div>
                </div>
            )}

            {/* Admin Header */}
            <header className="bg-theme-card border-b border-theme-border/40 px-6 py-4 flex items-center justify-between select-none transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <img src="/RFT360 Logo.png" alt="RFT360 Logo" className="w-8 h-8 object-contain" />
                    <div className="flex flex-col">
                        <span className="font-display font-semibold text-lg text-theme-h leading-tight">RedFort HRMS</span>
                        <span className="text-[10px] text-theme-muted font-bold uppercase tracking-wider">SYSTEM ADMINISTRATOR CENTER</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Theme Toggle Widget */}
                    <button 
                        onClick={toggleTheme}
                        className="p-2 border border-theme-border rounded-xl text-theme-muted hover:text-theme-h hover:bg-theme-canvas transition-all cursor-pointer bg-theme-card"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 border border-danger-border/40 hover:bg-danger-bg text-danger-rose font-semibold text-xs rounded-xl transition-all cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Logout Portal</span>
                    </button>
                </div>
            </header>

            {/* Admin Layout Body */}
            <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto animate-slide-up">
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* Left Registration Form Card */}
                    <div className="md:col-span-3 glass-panel p-6">
                        <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-6">
                            <UserPlus className="w-5 h-5 text-primary-red" />
                            <h3 className="font-semibold text-theme-h">Register Corporate Identity</h3>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Full Name</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-theme-muted">
                                            <UserCheck className="w-5 h-5" />
                                        </span>
                                        <input 
                                            type="text" 
                                            value={fullName} 
                                            onChange={(e) => setFullName(e.target.value)} 
                                            className="glass-input text-sm pl-12 pr-4"
                                            placeholder="Muhammad Ali" 
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Corporate Email</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-theme-muted">
                                            <Mail className="w-5 h-5" />
                                        </span>
                                        <input 
                                            type="email" 
                                            value={email} 
                                            onChange={(e) => setEmail(e.target.value)} 
                                            className="glass-input text-sm pl-12 pr-4"
                                            placeholder="ali@redfort.com" 
                                            required 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Secure Password</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-theme-muted">
                                            <Lock className="w-5 h-5" />
                                        </span>
                                        <input 
                                            type="password" 
                                            value={password} 
                                            onChange={(e) => setPassword(e.target.value)} 
                                            className="glass-input text-sm pl-12 pr-4"
                                            placeholder="••••••••" 
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Security Authorization Role</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-theme-muted pointer-events-none">
                                            <Shield className="w-5 h-5" />
                                        </span>
                                        <select 
                                            value={role} 
                                            onChange={(e) => setRole(e.target.value)}
                                            className="glass-select pl-12"
                                        >
                                            <option value={2}>Regular Employee</option>
                                            <option value={3}>Intern Trainee</option>
                                            <option value={1}>Line Manager</option>
                                            <option value={0}>Super Administrator</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Corporate Department</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-theme-muted">
                                            <Briefcase className="w-5 h-5" />
                                        </span>
                                        <input 
                                            type="text" 
                                            value={department} 
                                            onChange={(e) => setDepartment(e.target.value)} 
                                            className="glass-input text-sm pl-12 pr-4"
                                            placeholder="Engineering" 
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-theme-muted font-semibold uppercase">Line Manager</label>
                                        {loadingManagers && <RefreshCw className="w-3.5 h-3.5 animate-spin text-theme-muted" />}
                                    </div>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-theme-muted pointer-events-none">
                                            <KeyRound className="w-5 h-5" />
                                        </span>
                                        <select 
                                            value={managerId} 
                                            onChange={(e) => setManagerId(e.target.value)}
                                            className="glass-select pl-12"
                                        >
                                            <option value="">None (Independent reporting)</option>
                                            {managers.map(m => (
                                                <option key={m.id} value={m.id}>{m.fullName} ({m.department})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full bg-primary-red hover:bg-primary-red-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-primary-red/10 mt-4 flex items-center justify-center gap-2 hover:scale-[1.01]"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        <span>Initialize User Account</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Right Administrative Info Cards */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="glass-panel p-5">
                            <div className="flex items-center gap-2 border-b border-theme-border/30 pb-3 mb-3">
                                <Shield className="w-4.5 h-4.5 text-primary-red" />
                                <h4 className="font-semibold text-theme-h text-sm">Access Control Roles</h4>
                            </div>
                            <ul className="space-y-3 text-xs text-theme-muted">
                                <li>
                                    <strong className="text-theme-h font-medium">Super Administrator:</strong> Fully manages users registry, database resets, global system state.
                                </li>
                                <li>
                                    <strong className="text-theme-h font-medium">Line Manager:</strong> Creates geofence regions, monitors active staff coordinates, reviews leaves, assigns team matrix tasks.
                                </li>
                                <li>
                                    <strong className="text-theme-h font-medium">Employee / Intern:</strong> Submits geofenced check-ins, creates daily tasks, applications for leaves, flags blockers.
                                </li>
                            </ul>
                        </div>

                        <div className="glass-panel p-5 bg-theme-card/40">
                            <div className="flex items-center gap-2 border-b border-theme-border/30 pb-3 mb-3">
                                <Tag className="w-4.5 h-4.5 text-primary-red" />
                                <h4 className="font-semibold text-theme-h text-sm">Corporate Standards</h4>
                            </div>
                            <p className="text-xs text-theme-muted leading-relaxed">
                                Always register accounts utilizing corporate email standards (`@redfort.com`). Registered users will inherit role assignments immediately upon authentication.
                            </p>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
