import React, { useState, useEffect } from "react";
import { api, clearAuth, getUser } from "../api";
import { io } from "socket.io-client";
import { 
    Clock, CheckCircle2, AlertTriangle, Calendar, LogOut, 
    Plus, Check, X, Briefcase, MapPin, Sparkles, 
    RefreshCw, Bell, ChevronRight, MessageSquare, AlertCircle,
    Sun, Moon
} from "lucide-react";

export default function EmployeeDashboard({ theme, toggleTheme }) {
    const currentUser = getUser() || { fullName: "User", role: "Employee", department: "Workspace" };
    const [status, setStatus] = useState({ isCheckedIn: false, activeAttendance: null });
    const [tasks, setTasks] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [isOnsite, setIsOnsite] = useState(false);
    
    // Tab Navigation State (Mobile bottom nav, Desktop sidebar nav)
    const [activeTab, setActiveTab] = useState("shift"); // 'shift', 'tasks', 'leaves'

    // Shift elapsed timer ticker
    const [elapsedTime, setElapsedTime] = useState("00:00:00");

    // Form States
    const [selfTaskTitle, setSelfTaskTitle] = useState("");
    const [selfTaskDesc, setSelfTaskDesc] = useState("");
    const [selfTaskDeadline, setSelfTaskDeadline] = useState("");

    const [leaveType, setLeaveType] = useState("Casual");
    const [leaveStart, setLeaveStart] = useState("");
    const [leaveEnd, setLeaveEnd] = useState("");

    const [rejectionReason, setRejectionReason] = useState("");
    const [selectedTaskId, setSelectedTaskId] = useState(null); 

    // Visual Toast Notifications state
    const [toast, setToast] = useState(null);
    const [loadingData, setLoadingData] = useState(false);

    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
        }, 5000);
    };

    const fetchData = async (silent = false) => {
        if (!silent) setLoadingData(true);
        try {
            const statusData = await api.getAttendanceStatus();
            setStatus(statusData);

            const taskData = await api.getTasks();
            setTasks(taskData);

            const leaveData = await api.getLeaves();
            setLeaves(leaveData);

            const historyData = await api.getAttendanceHistory();
            setAttendanceHistory(historyData);
        } catch (err) {
            showToast(err.message || "Failed to sync dashboard data.", "error");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Setup Socket.io connection to listen for task assignments in real-time
        const token = localStorage.getItem("token");
        const socket = io("http://localhost:3000/hubs/hrms", {
            auth: { token },
            query: { access_token: token },
            transports: ["websocket"]
        });

        socket.on("ReceiveTaskAssignment", (data) => {
            showToast(`Task assigned: "${data.task.title}"`, "info");
            // Play notification sound
            try {
                const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav");
                audio.volume = 0.5;
                audio.play();
            } catch {
                console.log("Audio play blocked by browser policy");
            }
            fetchData(true);
        });

        socket.on("connect_error", (err) => {
            console.error("Socket Connection Error: ", err);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Live Shift Timer Ticker
    useEffect(() => {
        let interval = null;
        if (status.isCheckedIn && status.activeAttendance?.checkInTime) {
            const calculateElapsed = () => {
                const start = new Date(status.activeAttendance.checkInTime).getTime();
                const now = new Date().getTime();
                const diff = Math.max(0, now - start);

                const hrs = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);

                const formatNum = (n) => String(n).padStart(2, "0");
                setElapsedTime(`${formatNum(hrs)}:${formatNum(mins)}:${formatNum(secs)}`);
            };

            calculateElapsed();
            interval = setInterval(calculateElapsed, 1000);
        } else {
            setElapsedTime("00:00:00");
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status.isCheckedIn, status.activeAttendance]);

    const getCoordinates = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser."));
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
                    (err) => {
                        let errMsg = "Unable to retrieve your location.";
                        if (err.code === err.PERMISSION_DENIED) {
                            errMsg = "Location permissions denied. Please enable location services in your browser/device settings.";
                        }
                        reject(new Error(errMsg));
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            }
        });
    };

    const handleCheckIn = async () => {
        try {
            showToast("Acquiring GPS lock...", "info");
            const coords = await getCoordinates();
            showToast("Verifying check-in coordinates...", "info");
            await api.checkIn(coords.lat, coords.lon, isOnsite);
            showToast("Successfully checked in for today!", "success");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleCheckOut = async () => {
        try {
            showToast("Acquiring GPS lock...", "info");
            const coords = await getCoordinates();
            await api.checkOut(coords.lat, coords.lon);
            showToast("Successfully clocked out. Great work today!", "success");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleSelfCreateTask = async (e) => {
        e.preventDefault();
        try {
            await api.selfCreateTask({
                title: selfTaskTitle,
                description: selfTaskDesc,
                deadline: new Date(selfTaskDeadline).toISOString()
            });
            showToast("Self-created daily task saved!", "success");
            setSelfTaskTitle("");
            setSelfTaskDesc("");
            setSelfTaskDeadline("");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleRespondToTask = async (taskId, accept) => {
        if (!accept && !rejectionReason) {
            setSelectedTaskId(taskId);
            return;
        }
        try {
            await api.respondToTask(taskId, accept, accept ? null : rejectionReason);
            showToast(accept ? "Task accepted!" : "Task declined", accept ? "success" : "info");
            setRejectionReason("");
            setSelectedTaskId(null);
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleUpdateProgress = async (taskId, progress) => {
        try {
            await api.updateTaskProgress(taskId, parseInt(progress));
            showToast("Task status updated!", "success");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleReportBlocker = async (taskId) => {
        const desc = window.prompt("Explain the blocker details (e.g. Waiting on API deploy, design files missing):");
        if (desc === null) return; // cancelled
        if (!desc.trim()) {
            showToast("Blocker description cannot be empty", "error");
            return;
        }
        try {
            await api.reportBlocker(taskId, desc);
            showToast("Blocker reported to manager.", "success");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleApplyLeave = async (e) => {
        e.preventDefault();
        try {
            await api.applyLeave({
                leaveType,
                startDate: new Date(leaveStart).toISOString(),
                endDate: new Date(leaveEnd).toISOString()
            });
            showToast("Leave application submitted successfully!", "success");
            setLeaveStart("");
            setLeaveEnd("");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleLogout = () => {
        clearAuth();
        window.location.reload();
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-theme-canvas text-theme-body transition-colors duration-300">
            {/* Real-time floating Toast notification */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 transition-all duration-300 animate-slide-up max-w-sm ${
                    toast.type === "success" ? "bg-success-bg border-success-border text-success-green" :
                    toast.type === "error" ? "bg-danger-bg border-danger-border text-danger-rose" :
                    "bg-info-bg border-info-border text-info-blue"
                }`}>
                    {toast.type === "success" && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                    {toast.type === "error" && <AlertTriangle className="w-5 h-5 shrink-0" />}
                    {toast.type === "info" && <Bell className="w-5 h-5 shrink-0" />}
                    <div className="text-sm font-medium">{toast.message}</div>
                </div>
            )}

            {/* Sidebar for Desktop, hidden on Mobile */}
            <aside className="hidden md:flex flex-col w-64 bg-theme-card border-r border-theme-border/40 shrink-0 select-none transition-colors duration-300">
                <div className="p-6 border-b border-theme-border/30 flex items-center gap-3">
                    <img src="/RFT360 Logo.png" alt="RFT360 Logo" className="w-8 h-8 object-contain" />
                    <span className="font-display font-semibold text-lg text-theme-h">RedFort HRMS</span>
                </div>

                {/* User Info */}
                <div className="p-5 border-b border-theme-border/30 bg-theme-canvas/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-red flex items-center justify-center font-bold text-white text-base">
                            {currentUser.fullName.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <h4 className="text-sm font-semibold text-theme-h truncate">{currentUser.fullName}</h4>
                            <p className="text-xs text-theme-muted truncate">{currentUser.role} • {currentUser.department}</p>
                        </div>
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <nav className="flex-1 p-4 space-y-1.5">
                    <button 
                        onClick={() => setActiveTab("shift")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            activeTab === "shift" 
                            ? "bg-primary-red text-white shadow-lg shadow-primary-red/20" 
                            : "text-theme-muted hover:text-theme-h hover:bg-theme-canvas/50"
                        }`}
                    >
                        <Clock className="w-5 h-5" />
                        <span>Shift Tracker</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab("tasks")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            activeTab === "tasks" 
                            ? "bg-primary-red text-white shadow-lg shadow-primary-red/20" 
                            : "text-theme-muted hover:text-theme-h hover:bg-theme-canvas/50"
                        }`}
                    >
                        <Briefcase className="w-5 h-5" />
                        <span>Daily Tasks</span>
                        {tasks.filter(t => t.progressStatus !== "Completed").length > 0 && (
                            <span className="ml-auto bg-theme-canvas border border-theme-border text-theme-h text-xs px-2 py-0.5 rounded-full font-bold">
                                {tasks.filter(t => t.progressStatus !== "Completed").length}
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => setActiveTab("leaves")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            activeTab === "leaves" 
                            ? "bg-primary-red text-white shadow-lg shadow-primary-red/20" 
                            : "text-theme-muted hover:text-theme-h hover:bg-theme-canvas/50"
                        }`}
                    >
                        <Calendar className="w-5 h-5" />
                        <span>Leaves Tracker</span>
                    </button>
                </nav>

                {/* Sidebar Footer Logout */}
                <div className="p-4 border-t border-theme-border/30">
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-danger-rose hover:bg-danger-bg hover:border-danger-border border border-transparent transition-all cursor-pointer"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Logout Portal</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header Nav (Only visible on mobile) */}
            <header className="md:hidden flex items-center justify-between px-6 py-4 bg-theme-card border-b border-theme-border/30 shrink-0 select-none transition-colors duration-300">
                <div className="flex items-center gap-2">
                    <img src="/RFT360 Logo.png" alt="RFT360 Logo" className="w-6 h-6 object-contain" />
                    <span className="font-display font-semibold text-base text-theme-h">RedFort HRMS</span>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={toggleTheme}
                        className="p-2 border border-theme-border rounded-xl text-theme-muted hover:text-theme-h transition-all cursor-pointer bg-theme-card"
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <div className="flex flex-col text-right">
                        <span className="text-xs font-semibold text-theme-h truncate max-w-[100px]">{currentUser.fullName}</span>
                        <span className="text-[10px] text-theme-muted">{currentUser.role}</span>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-danger-rose hover:bg-danger-bg rounded-lg transition-colors cursor-pointer"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 relative">
                {/* Sync indicator */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl md:text-2xl font-display font-bold text-theme-h tracking-tight">
                            {activeTab === "shift" && "Shift Attendance"}
                            {activeTab === "tasks" && "Task Matrix"}
                            {activeTab === "leaves" && "Leave Request Center"}
                        </h2>
                        {loadingData && (
                            <RefreshCw className="w-4 h-4 animate-spin text-theme-muted" />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={toggleTheme}
                            className="hidden md:flex p-2 border border-theme-border rounded-xl text-theme-muted hover:text-theme-h hover:bg-theme-card transition-all cursor-pointer bg-theme-card items-center gap-1.5 text-xs font-medium"
                            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                            <span>Theme</span>
                        </button>
                        <button 
                            onClick={() => fetchData()}
                            className="p-2 border border-theme-border rounded-xl text-theme-muted hover:text-theme-h hover:bg-theme-card transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Sync</span>
                        </button>
                    </div>
                </div>

                {/* 1. TAB: SHIFT ATTENDANCE */}
                {activeTab === "shift" && (
                    <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
                        
                        {/* Clock In-Out Controller Card */}
                        <div className="lg:col-span-2 glass-panel p-6 flex flex-col justify-between min-h-[300px]">
                            <div>
                                <div className="flex items-center justify-between border-b border-theme-border/30 pb-4 mb-6">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-primary-red" />
                                        <h3 className="font-semibold text-theme-h">Daily Tracker</h3>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-theme-muted bg-theme-canvas px-3 py-1 rounded-full border border-theme-border">
                                        <span className={`w-2 h-2 rounded-full ${status.isCheckedIn ? "bg-success-green animate-pulse" : "bg-gray-600"}`}></span>
                                        <span>{status.isCheckedIn ? "ACTIVE SHIFT" : "CLOCKED OUT"}</span>
                                    </div>
                                </div>

                                {/* Shift timer clock display */}
                                <div className="flex flex-col items-center justify-center py-6">
                                    <div className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center bg-theme-canvas border-2 ${
                                        status.isCheckedIn ? "border-success-green/30 animate-pulse-ring" : "border-theme-border"
                                    }`}>
                                        <span className="text-[10px] uppercase tracking-widest text-theme-muted mb-1">Time Elapsed</span>
                                        <span className={`text-3xl font-display font-bold tabular-nums ${
                                            status.isCheckedIn ? "text-success-green" : "text-theme-muted"
                                        }`}>
                                            {elapsedTime}
                                        </span>
                                        <span className="text-[10px] text-theme-muted mt-1">HH:MM:SS</span>
                                    </div>

                                    {status.isCheckedIn && status.activeAttendance && (
                                        <div className="mt-6 text-center text-sm bg-theme-canvas/40 px-4 py-2 border border-theme-border/20 rounded-xl max-w-sm">
                                            <p className="text-theme-muted">Checked In at {new Date(status.activeAttendance.checkInTime).toLocaleTimeString()}</p>
                                            <p className="text-xs text-theme-muted mt-1">Geofence validation: {status.activeAttendance.isOnsite ? "Onsite Approved" : "Offsite Allowed"}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Clock in/out Button Actions */}
                            <div className="border-t border-theme-border/30 pt-6 mt-4">
                                {!status.isCheckedIn ? (
                                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                                        <label className="flex items-center gap-3 bg-theme-canvas/50 border border-theme-border px-4 py-3 rounded-xl cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={isOnsite} 
                                                onChange={(e) => setIsOnsite(e.target.checked)}
                                                className="w-5 h-5 rounded border-theme-border text-primary-red focus:ring-primary-red bg-theme-card accent-primary-red cursor-pointer"
                                            /> 
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-theme-h">Onsite Shift</span>
                                                <span className="text-xs text-theme-muted">Validate Geofence Coordinates</span>
                                            </div>
                                        </label>
                                        <button 
                                            onClick={handleCheckIn}
                                            className="bg-primary-red hover:bg-primary-red-hover text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary-red/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
                                        >
                                            <Sparkles className="w-5 h-5" />
                                            <span>Check-In Shift</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={handleCheckOut}
                                            className="w-full md:w-auto bg-theme-canvas border border-danger-rose hover:bg-danger-bg text-danger-rose font-bold py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <LogOut className="w-5 h-5" />
                                            <span>Check-Out Shift</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Shift Guideline Card */}
                        <div className="glass-panel p-6 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-4">
                                    <MapPin className="w-5 h-5 text-primary-red" />
                                    <h3 className="font-semibold text-theme-h">Geofence Rules</h3>
                                </div>
                                <ul className="space-y-3.5 text-sm text-theme-muted">
                                    <li className="flex gap-2">
                                        <ChevronRight className="w-4 h-4 text-primary-red shrink-0 mt-0.5" />
                                        <span>Onsite shifts require you to check-in within designated radii of corporate coordinates.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <ChevronRight className="w-4 h-4 text-primary-red shrink-0 mt-0.5" />
                                        <span>If you are working offsite/remotely, uncheck the "Onsite Shift" box to bypass geofence check.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <ChevronRight className="w-4 h-4 text-primary-red shrink-0 mt-0.5" />
                                        <span>Ensure GPS permissions are enabled when prompt request displays.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="p-4 bg-theme-canvas border border-theme-border/50 rounded-xl mt-4">
                                <div className="flex items-center gap-2.5">
                                    <AlertCircle className="w-5 h-5 text-warning-yellow shrink-0" />
                                    <span className="text-xs text-warning-yellow font-medium">Automatic system flag for check-outs beyond workspace zones.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Attendance History Log */}
                    <div className="glass-panel p-6 mt-6">
                        <div className="flex items-center justify-between border-b border-theme-border/30 pb-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary-red" />
                                <h3 className="font-semibold text-theme-h">Past Attendance History</h3>
                            </div>
                            <span className="text-xs text-theme-muted">{attendanceHistory.length} records</span>
                        </div>

                        {attendanceHistory.length === 0 ? (
                            <div className="text-center py-12 text-theme-muted text-sm">
                                No attendance records found. Check in to start building your history.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-theme-border/30 text-theme-muted text-xs uppercase font-semibold">
                                            <th className="py-3 px-3">Date</th>
                                            <th className="py-3 px-3">Check-In</th>
                                            <th className="py-3 px-3">Check-Out</th>
                                            <th className="py-3 px-3">Duration</th>
                                            <th className="py-3 px-3">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceHistory.map(a => {
                                            const checkIn = new Date(a.checkInTime);
                                            const checkOut = a.checkOutTime ? new Date(a.checkOutTime) : null;
                                            let duration = "-";
                                            if (checkOut) {
                                                const diffMs = checkOut.getTime() - checkIn.getTime();
                                                const hrs = Math.floor(diffMs / (1000 * 60 * 60));
                                                const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                                duration = `${hrs}h ${mins}m`;
                                            }
                                            return (
                                                <tr key={a.id} className="border-b border-theme-border/20 text-theme-body hover:bg-theme-canvas/20">
                                                    <td className="py-3 px-3 text-xs font-semibold text-theme-h">
                                                        {checkIn.toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3 px-3 text-xs text-theme-muted">
                                                        {checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="py-3 px-3 text-xs">
                                                        {checkOut ? (
                                                            <span className="text-theme-muted">{checkOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-success-green uppercase bg-success-bg border border-success-border/30 px-2 py-0.5 rounded">Active</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-xs text-theme-h font-semibold tabular-nums">{duration}</td>
                                                    <td className="py-3 px-3">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                                            a.isOnsite 
                                                            ? "bg-info-bg text-info-blue border border-info-border/30" 
                                                            : "bg-theme-canvas text-theme-muted border border-theme-border"
                                                        }`}>
                                                            {a.isOnsite ? "Onsite" : "Offsite"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    </>
                )}

                {/* 2. TAB: DAILY TASKS */}
                {activeTab === "tasks" && (
                    <div className="space-y-6 animate-slide-up">
                        
                        {/* Task Self Creator Card */}
                        <div className="glass-panel p-6">
                            <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-4">
                                <Plus className="w-5 h-5 text-primary-red" />
                                <h3 className="font-semibold text-theme-h">Add Self-Created Task for the Day</h3>
                            </div>
                            
                            <form onSubmit={handleSelfCreateTask} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Task Title</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter title..." 
                                        value={selfTaskTitle} 
                                        onChange={e => setSelfTaskTitle(e.target.value)} 
                                        className="glass-input text-sm px-4 py-2.5" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Description / Notes</label>
                                    <input 
                                        type="text" 
                                        placeholder="Details (Optional)..." 
                                        value={selfTaskDesc} 
                                        onChange={e => setSelfTaskDesc(e.target.value)} 
                                        className="glass-input text-sm px-4 py-2.5" 
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <div className="space-y-2 flex-1">
                                        <label className="text-xs text-theme-muted font-semibold uppercase">Deadline</label>
                                        <input 
                                            type="datetime-local" 
                                            value={selfTaskDeadline} 
                                            onChange={e => setSelfTaskDeadline(e.target.value)} 
                                            className="glass-input text-sm px-4 py-2.5 text-theme-muted" 
                                            required 
                                        />
                                    </div>
                                    <button 
                                        type="submit" 
                                        className="bg-primary-red hover:bg-primary-red-hover text-white font-bold px-5 h-[46px] rounded-xl flex items-center justify-center shrink-0 cursor-pointer shadow-md shadow-primary-red/10"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Task List Grid */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-base font-semibold text-theme-h font-display">Tasks Registry</h4>
                                <span className="text-xs text-theme-muted">{tasks.length} total tasks</span>
                            </div>

                            {tasks.length === 0 ? (
                                <div className="glass-panel p-8 text-center text-theme-muted text-sm">
                                    No tasks registered for you today. Take some initiative or sync from the dashboard.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {tasks.map(t => (
                                        <div key={t.id} className="glass-panel p-5 flex flex-col justify-between border-t-2 border-t-theme-border/40 hover:border-t-primary-red/50 transition-all duration-300">
                                            <div>
                                                {/* Header Priority Badge */}
                                                <div className="flex items-center justify-between mb-3.5">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                                        t.priority === 3 || t.priority === "Critical" ? "bg-danger-bg text-danger-rose border border-danger-border" :
                                                        t.priority === 2 || t.priority === "High" ? "bg-warning-bg text-warning-yellow border border-warning-border" :
                                                        t.priority === 0 || t.priority === "Low" ? "bg-theme-canvas text-theme-muted border border-theme-border" :
                                                        "bg-info-bg text-info-blue border border-info-border"
                                                    }`}>
                                                        {t.priority === 3 ? "CRITICAL" : t.priority === 2 ? "HIGH" : t.priority === 0 ? "LOW" : "MEDIUM"}
                                                    </span>

                                                    <span className="text-xs text-theme-muted">
                                                        {t.assignmentStatus === "SelfCreated" ? "Self" : "Assigned"}
                                                    </span>
                                                </div>

                                                <h5 className="font-semibold text-theme-h text-base leading-snug mb-1">{t.title}</h5>
                                                <p className="text-xs text-theme-muted line-clamp-3 mb-4">{t.description || "No description provided."}</p>
                                            </div>

                                            {/* Footer Control Panel */}
                                            <div className="border-t border-theme-border/30 pt-4 mt-2">
                                                <div className="flex items-center justify-between mb-3 text-[11px] text-theme-muted">
                                                    <span>Due: {new Date(t.deadline).toLocaleDateString()} {new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>

                                                {/* Accept / Reject controls for Manager Assigned */}
                                                {t.assignmentStatus === "PendingAcceptance" && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => handleRespondToTask(t.id, true)} 
                                                                className="flex-1 bg-success-green/20 border border-success-green/40 hover:bg-success-green hover:text-white text-success-green py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Accept</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleRespondToTask(t.id, false)} 
                                                                className="flex-1 bg-danger-bg border border-danger-border text-danger-rose hover:bg-danger-rose hover:text-white py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                <span>Decline</span>
                                                            </button>
                                                        </div>

                                                        {selectedTaskId === t.id && (
                                                            <div className="flex gap-2 animate-slide-up">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Reason for declining..." 
                                                                    value={rejectionReason}
                                                                    onChange={e => setRejectionReason(e.target.value)} 
                                                                    className="glass-input text-xs px-4 py-1.5 flex-1"
                                                                    required
                                                                />
                                                                <button 
                                                                    onClick={() => handleRespondToTask(t.id, false)}
                                                                    className="bg-primary-red hover:bg-primary-red-hover text-white text-xs px-3 rounded-lg font-bold cursor-pointer"
                                                                >
                                                                    Send
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Active Task Operations */}
                                                {(t.assignmentStatus === "Accepted" || t.assignmentStatus === "ForceAssigned" || t.assignmentStatus === "SelfCreated") && (
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="relative flex-1">
                                                            <select 
                                                                value={t.progressStatus === "Pending" ? 0 : t.progressStatus === "InProgress" ? 1 : 2}
                                                                onChange={e => handleUpdateProgress(t.id, e.target.value)}
                                                                className="glass-select text-xs py-2 pl-4"
                                                            >
                                                                <option value={0}>Pending</option>
                                                                <option value={1}>In Progress</option>
                                                                <option value={2}>Completed</option>
                                                            </select>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleReportBlocker(t.id)} 
                                                            className="text-xs font-semibold py-2 px-3 border border-theme-border hover:border-danger-border hover:bg-danger-bg text-theme-muted hover:text-danger-rose rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                            <span>Blocker</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. TAB: LEAVES CENTER */}
                {activeTab === "leaves" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
                        
                        {/* Leave Application Panel */}
                        <div className="glass-panel p-6 h-fit">
                            <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-5">
                                <Calendar className="w-5 h-5 text-primary-red" />
                                <h3 className="font-semibold text-theme-h">Apply for Leave</h3>
                            </div>

                            <form onSubmit={handleApplyLeave} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider">Leave Type</label>
                                    <select 
                                        value={leaveType} 
                                        onChange={e => setLeaveType(e.target.value)}
                                        className="glass-select text-sm py-2.5 pl-4"
                                    >
                                        <option value="Casual">Casual Leave</option>
                                        <option value="Sick">Sick Leave</option>
                                        <option value="Annual">Annual Vacation</option>
                                        <option value="Emergency">Emergency Leave</option>
                                        <option value="Unpaid">Unpaid Leave</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider">Start Date</label>
                                        <input 
                                            type="date" 
                                            value={leaveStart} 
                                            onChange={e => setLeaveStart(e.target.value)} 
                                            className="glass-input text-sm px-4 py-2.5 text-theme-h"
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider">End Date</label>
                                        <input 
                                            type="date" 
                                            value={leaveEnd} 
                                            onChange={e => setLeaveEnd(e.target.value)} 
                                            className="glass-input text-sm px-4 py-2.5 text-theme-h"
                                            required 
                                        />
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full bg-primary-red hover:bg-primary-red-hover text-white font-bold py-3 px-4 rounded-xl transition-all cursor-pointer shadow-lg shadow-primary-red/10 mt-2 hover:scale-[1.01]"
                                >
                                    Submit Leave Request
                                </button>
                            </form>
                        </div>

                        {/* History Log */}
                        <div className="lg:col-span-2 glass-panel p-6">
                            <div className="flex items-center justify-between border-b border-theme-border/30 pb-4 mb-4">
                                <h3 className="font-semibold text-theme-h">Application History Logs</h3>
                                <span className="text-xs text-theme-muted">{leaves.length} applications</span>
                            </div>

                            {leaves.length === 0 ? (
                                <div className="text-center py-16 text-theme-muted text-sm">
                                    You have no leave history. Any submitted applications will appear here.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="border-b border-theme-border/30 text-theme-muted text-xs uppercase font-semibold">
                                                <th className="py-3 px-2">Type</th>
                                                <th className="py-3 px-2">Duration</th>
                                                <th className="py-3 px-2">Status</th>
                                                <th className="py-3 px-2">Manager Response</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaves.map(l => (
                                                <tr key={l.id} className="border-b border-theme-border/20 text-theme-body hover:bg-theme-canvas/20">
                                                    <td className="py-4.5 px-2 font-semibold text-theme-h">{l.leaveType}</td>
                                                    <td className="py-4.5 px-2 text-xs">
                                                        {new Date(l.startDate).toLocaleDateString()} <span className="text-theme-muted">to</span> {new Date(l.endDate).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-4.5 px-2">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                            l.status === "Approved" ? "bg-success-bg text-success-green border border-success-border/30" : 
                                                            l.status === "Rejected" ? "bg-danger-bg text-danger-rose border border-danger-border/30" : 
                                                            "bg-warning-bg text-warning-yellow border border-warning-border/30"
                                                        }`}>
                                                            {l.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4.5 px-2 text-xs text-theme-muted">
                                                        {l.managerReason || "-"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Nav Bar for Mobile screens */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-theme-card border-t border-theme-border/50 flex items-center justify-around py-2 safe-padding-bottom shadow-black/10 shadow-2xl select-none transition-colors duration-300">
                <button 
                    onClick={() => setActiveTab("shift")}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                        activeTab === "shift" ? "text-primary-red" : "text-theme-muted"
                    }`}
                >
                    <Clock className="w-5 h-5" />
                    <span className="text-[10px] font-semibold mt-1">Shift</span>
                </button>

                <button 
                    onClick={() => setActiveTab("tasks")}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl relative transition-all cursor-pointer ${
                        activeTab === "tasks" ? "text-primary-red" : "text-theme-muted"
                    }`}
                >
                    <Briefcase className="w-5 h-5" />
                    {tasks.filter(t => t.progressStatus !== "Completed").length > 0 && (
                        <span className="absolute top-0 right-2 w-2.5 h-2.5 bg-primary-red rounded-full ring-2 ring-theme-card"></span>
                    )}
                    <span className="text-[10px] font-semibold mt-1">Tasks</span>
                </button>

                <button 
                    onClick={() => setActiveTab("leaves")}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                        activeTab === "leaves" ? "text-primary-red" : "text-theme-muted"
                    }`}
                >
                    <Calendar className="w-5 h-5" />
                    <span className="text-[10px] font-semibold mt-1">Leaves</span>
                </button>
            </nav>
        </div>
    );
}
