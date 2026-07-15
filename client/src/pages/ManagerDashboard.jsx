import React, { useState, useEffect } from "react";
import { api, clearAuth } from "../api";
import { io } from "socket.io-client";
import { 
    Users, MapPin, Briefcase, Calendar, LogOut, 
    Plus, Check, X, AlertTriangle, RefreshCw, 
    Bell, Globe, Trash2, ShieldCheck, Compass, 
    MessageSquare, ArrowRightLeft, Sun, Moon, ClipboardList
} from "lucide-react";

export default function ManagerDashboard({ theme, toggleTheme }) {
    const [employees, setEmployees] = useState([]);
    const [locations, setLocations] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [employeeTasks, setEmployeeTasks] = useState([]);
    
    // Tab Navigation State (Mobile bottom nav, Desktop sidebar nav)
    const [activeTab, setActiveTab] = useState("team"); // 'team', 'locations', 'tasks', 'empTasks', 'leaves'

    // Form States
    const [locName, setLocName] = useState("");
    const [locLat, setLocLat] = useState("");
    const [locLon, setLocLon] = useState("");
    const [locRadius, setLocRadius] = useState(100);

    const [taskTitle, setTaskTitle] = useState("");
    const [taskDesc, setTaskDesc] = useState("");
    const [taskDeadline, setTaskDeadline] = useState("");
    const [taskPriority, setTaskPriority] = useState(1); // Medium
    const [taskAssignee, setTaskAssignee] = useState("");

    const [leaveComments, setLeaveComments] = useState({});
    const [reassignTarget, setReassignTarget] = useState({});

    // Toast and Loaders
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
            const empData = await api.getEmployees();
            setEmployees(empData);

            const locData = await api.getLocations();
            setLocations(locData);

            const taskData = await api.getTasks();
            setTasks(taskData);

            const leaveData = await api.getLeaves();
            setLeaves(leaveData);

            const empTaskData = await api.getEmployeeSelfCreatedTasks();
            setEmployeeTasks(empTaskData);
        } catch (err) {
            showToast(err.message || "Failed to load dashboard data.", "error");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Setup Socket.io connection to listen for task response updates
        const token = localStorage.getItem("token");
        const socket = io("http://localhost:3000/hubs/hrms", {
            auth: { token },
            query: { access_token: token },
            transports: ["websocket"]
        });

        const playSfx = () => {
            try {
                const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav");
                audio.volume = 0.5;
                audio.play();
            } catch {
                console.log("Audio play blocked by browser policy");
            }
        };

        socket.on("ReceiveTaskResponse", (data) => {
            showToast(`Task update from ${data.employeeName}: ${data.status} for "${data.taskTitle}"`, "info");
            playSfx();
            fetchData(true);
        });

        socket.on("ReceiveTaskProgressUpdate", (data) => {
            showToast(`Progress update: "${data.taskTitle}" is now ${data.progressStatus}`, "success");
            playSfx();
            fetchData(true);
        });

        socket.on("ReceiveBlockerReported", (data) => {
            showToast(`ALERT: Blocker flagged by ${data.employeeName} on "${data.taskTitle}"`, "error");
            playSfx();
            fetchData(true);
        });

        socket.on("connect_error", (err) => {
            console.error("Socket Connection Error: ", err);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleCreateLocation = async (e) => {
        e.preventDefault();
        try {
            await api.createLocation({
                name: locName,
                latitude: parseFloat(locLat),
                longitude: parseFloat(locLon),
                radiusInMeters: parseFloat(locRadius)
            });
            showToast(`Saved geofence location: ${locName}!`, "success");
            setLocName("");
            setLocLat("");
            setLocLon("");
            setLocRadius(100);
            fetchData();
        } catch (err) {
            showToast(err.message || "Failed to create location.", "error");
        }
    };

    const handleAssignLocation = async (employeeId, locationId) => {
        try {
            await api.assignLocation(employeeId, locationId ? locationId : null);
            showToast("Assigned geofence zone updated!", "success");
            fetchData();
        } catch (err) {
            showToast(err.message || "Failed to assign location.", "error");
        }
    };

    const handleAssignTask = async (e) => {
        e.preventDefault();
        if (!taskAssignee) {
            showToast("Please select a target employee.", "error");
            return;
        }
        try {
            await api.assignTask({
                title: taskTitle,
                description: taskDesc,
                deadline: new Date(taskDeadline).toISOString(),
                priority: parseInt(taskPriority),
                assignedToId: taskAssignee
            });
            showToast("Task assigned to team member!", "success");
            setTaskTitle("");
            setTaskDesc("");
            setTaskDeadline("");
            setTaskAssignee("");
            fetchData();
        } catch (err) {
            showToast(err.message || "Failed to assign task.", "error");
        }
    };

    const handleForceAssign = async (taskId) => {
        try {
            await api.forceAssignTask(taskId);
            showToast("Task force-assigned to employee.", "success");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleReassign = async (taskId) => {
        const targetEmp = reassignTarget[taskId];
        if (!targetEmp) {
            showToast("Select an employee to reassign to.", "error");
            return;
        }
        try {
            await api.reassignTask(taskId, targetEmp);
            showToast("Task reassigned successfully!", "success");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleRemoveTask = async (taskId) => {
        if (!window.confirm("Remove this task assignment? This action cannot be undone.")) return;
        try {
            await api.removeTask(taskId);
            showToast("Task removed from workspace.", "success");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleProcessLeave = async (leaveId, approve) => {
        const comment = leaveComments[leaveId] || "";
        if (!approve && !comment.trim()) {
            showToast("Rejection reason is required in comments.", "error");
            return;
        }
        try {
            await api.processLeave(leaveId, approve ? 1 : 2, comment);
            showToast(`Leave application ${approve ? "approved" : "declined"}!`, approve ? "success" : "info");
            fetchData();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleLogout = () => {
        clearAuth();
        window.location.reload();
    };

    // Calculate Summary Stats
    const activeStaff = employees.filter(e => e.activeAttendance.isCheckedIn).length;
    const pendingLeavesCount = leaves.filter(l => l.status === "Pending").length;
    const totalBlockers = tasks.reduce((acc, t) => acc + (t.blockers ? t.blockers.length : 0), 0);

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-theme-canvas text-theme-body transition-colors duration-300">
            {/* Custom Toast Alert */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 transition-all duration-300 animate-slide-up max-w-sm ${
                    toast.type === "success" ? "bg-success-bg border-success-border text-success-green" :
                    toast.type === "error" ? "bg-danger-bg border-danger-border text-danger-rose" :
                    "bg-info-bg border-info-border text-info-blue"
                }`}>
                    {toast.type === "success" && <ShieldCheck className="w-5 h-5 shrink-0" />}
                    {toast.type === "error" && <AlertTriangle className="w-5 h-5 shrink-0" />}
                    {toast.type === "info" && <Bell className="w-5 h-5 shrink-0" />}
                    <div className="text-sm font-medium">{toast.message}</div>
                </div>
            )}

            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-theme-card border-r border-theme-border/40 shrink-0 select-none transition-colors duration-300">
                <div className="p-6 border-b border-theme-border/30 flex items-center gap-3">
                    <img src="/RFT360 Logo.png" alt="RFT360 Logo" className="w-8 h-8 object-contain" />
                    <span className="font-display font-semibold text-lg text-theme-h">RedFort HRMS</span>
                </div>

                <div className="p-5 border-b border-theme-border/30 bg-theme-canvas/20">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-theme-muted block mb-1">MANAGER HUB</span>
                    <span className="text-sm font-semibold text-theme-h">Line Manager Workspace</span>
                </div>

                {/* Sidebar Menu Nav */}
                <nav className="flex-1 p-4 space-y-1.5">
                    <button 
                        onClick={() => setActiveTab("team")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            activeTab === "team" 
                            ? "bg-primary-red text-white shadow-lg shadow-primary-red/20" 
                            : "text-theme-muted hover:text-theme-h hover:bg-theme-canvas/50"
                        }`}
                    >
                        <Users className="w-5 h-5" />
                        <span>Team Directory</span>
                        {activeStaff > 0 && (
                            <span className="ml-auto bg-success-green/20 border border-success-green/30 text-success-green text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {activeStaff} online
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => setActiveTab("locations")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            activeTab === "locations" 
                            ? "bg-primary-red text-white shadow-lg shadow-primary-red/20" 
                            : "text-theme-muted hover:text-theme-h hover:bg-theme-canvas/50"
                        }`}
                    >
                        <MapPin className="w-5 h-5" />
                        <span>Geofence Registry</span>
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
                        <span>Tasks Board</span>
                        {totalBlockers > 0 && (
                            <span className="ml-auto bg-danger-bg border border-danger-border text-danger-rose text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                                {totalBlockers} blocked
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
                        <span>Leave Processing</span>
                        {pendingLeavesCount > 0 && (
                            <span className="ml-auto bg-warning-bg border border-warning-border text-warning-yellow text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {pendingLeavesCount} pending
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => setActiveTab("empTasks")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                            activeTab === "empTasks" 
                            ? "bg-primary-red text-white shadow-lg shadow-primary-red/20" 
                            : "text-theme-muted hover:text-theme-h hover:bg-theme-canvas/50"
                        }`}
                    >
                        <ClipboardList className="w-5 h-5" />
                        <span>Employee Tasks</span>
                        {employeeTasks.length > 0 && (
                            <span className="ml-auto bg-info-bg border border-info-border text-info-blue text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {employeeTasks.length}
                            </span>
                        )}
                    </button>
                </nav>

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

            {/* Mobile Header Nav */}
            <header className="md:hidden flex items-center justify-between px-6 py-4 bg-theme-card border-b border-theme-border/30 shrink-0 select-none transition-colors duration-300">
                <div className="flex items-center gap-2">
                    <img src="/RFT360 Logo.png" alt="RFT360 Logo" className="w-6 h-6 object-contain" />
                    <span className="font-display font-semibold text-base text-theme-h">RF Manager</span>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={toggleTheme}
                        className="p-2 border border-theme-border rounded-xl text-theme-muted hover:text-theme-h transition-all cursor-pointer bg-theme-card"
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-danger-rose hover:bg-danger-bg rounded-lg transition-colors cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 relative">
                
                {/* Dashboard Navigation Title */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl md:text-2xl font-display font-bold text-theme-h tracking-tight">
                            {activeTab === "team" && "Team Attendance Grid"}
                            {activeTab === "locations" && "Geofenced Zones Manager"}
                            {activeTab === "tasks" && "Assigned Work Center"}
                            {activeTab === "empTasks" && "Employee Self-Created Tasks"}
                            {activeTab === "leaves" && "Employee Leaves Desk"}
                        </h2>
                        {loadingData && (
                            <RefreshCw className="w-4 h-4 animate-spin text-theme-muted" />
                        )}
                    </div>
                    <div className="flex items-center gap-2.5">
                        {/* Theme toggler inside Main Desk for Desktop */}
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
                            <span>Refresh Workspace</span>
                        </button>
                    </div>
                </div>

                {/* Dashboard Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                    <div className="glass-panel p-5 border-l-4 border-l-success-green">
                        <span className="text-xs text-theme-muted font-semibold uppercase tracking-wider block">Checked-In Staff</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-3xl font-display font-bold text-theme-h tabular-nums">{activeStaff}</span>
                            <span className="text-xs text-theme-muted">/ {employees.length} total</span>
                        </div>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-l-danger-rose">
                        <span className="text-xs text-theme-muted font-semibold uppercase tracking-wider block">Active Blocker Flags</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-3xl font-display font-bold text-theme-h tabular-nums">{totalBlockers}</span>
                            <span className="text-xs text-theme-muted">requiring actions</span>
                        </div>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-l-warning-yellow">
                        <span className="text-xs text-theme-muted font-semibold uppercase tracking-wider block">Pending Leave Requests</span>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-3xl font-display font-bold text-theme-h tabular-nums">{pendingLeavesCount}</span>
                            <span className="text-xs text-theme-muted">review needed</span>
                        </div>
                    </div>
                </div>

                {/* 1. TAB: TEAM ATTENDANCE */}
                {activeTab === "team" && (
                    <div className="glass-panel p-6 animate-slide-up overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-4">
                            <Users className="w-5 h-5 text-primary-red" />
                            <h3 className="font-semibold text-theme-h">Managed Employees & Attendance Logs</h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-theme-border/30 text-theme-muted text-xs uppercase font-semibold">
                                        <th className="py-3 px-3">Name & Role</th>
                                        <th className="py-3 px-3">Department</th>
                                        <th className="py-3 px-3">Shift Status</th>
                                        <th className="py-3 px-3">Last Check-Out</th>
                                        <th className="py-3 px-3">Last Logged In</th>
                                        <th className="py-3 px-3">Assigned Zone Geofence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => (
                                        <tr key={emp.id} className="border-b border-theme-border/20 text-theme-body hover:bg-theme-canvas/20">
                                            <td className="py-4 px-3">
                                                <div className="font-semibold text-theme-h">{emp.fullName}</div>
                                                <div className="text-xs text-theme-muted uppercase tracking-wider mt-0.5">
                                                    {emp.role === 3 || emp.role === "Intern" ? "Intern" : "Employee"}
                                                </div>
                                            </td>
                                            <td className="py-4 px-3 text-xs text-theme-muted">{emp.department}</td>
                                            <td className="py-4 px-3">
                                                {emp.activeAttendance.isCheckedIn ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-bold text-success-green uppercase bg-success-bg border border-success-border/30 px-2 py-0.5 rounded w-fit">
                                                            Checked-In ({emp.activeAttendance.isOnsite ? "Onsite" : "Offsite"})
                                                        </span>
                                                        <span className="text-[11px] text-theme-muted">
                                                            Since {new Date(emp.activeAttendance.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                        <span className="text-[10px] text-theme-muted font-mono">
                                                            GPS: {emp.activeAttendance.latitude.toFixed(4)}, {emp.activeAttendance.longitude.toFixed(4)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-theme-muted uppercase bg-theme-canvas/50 border border-theme-border px-2 py-0.5 rounded">
                                                        Checked-Out
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-3 text-xs">
                                                {emp.lastCheckOut ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-theme-muted">
                                                            {new Date(emp.lastCheckOut.checkOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                        <span className="text-[10px] text-theme-muted">
                                                            {new Date(emp.lastCheckOut.checkOutTime).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-theme-muted">-</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-3 text-xs text-theme-muted">
                                                {emp.lastLogin ? new Date(emp.lastLogin).toLocaleString() : "Never Logged In"}
                                            </td>
                                            <td className="py-4 px-3">
                                                <select 
                                                    value={emp.assignedLocationId || ""} 
                                                    onChange={(e) => handleAssignLocation(emp.id, e.target.value)}
                                                    className="glass-select text-xs py-1.5 pl-3"
                                                >
                                                    <option value="">No Location (Offsite Allowed)</option>
                                                    {locations.map(loc => (
                                                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.radiusInMeters}m)</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. TAB: GEOFENCE REGISTRY */}
                {activeTab === "locations" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
                        {/* Create Location Form */}
                        <div className="glass-panel p-6 h-fit">
                            <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-4">
                                <Plus className="w-5 h-5 text-primary-red" />
                                <h3 className="font-semibold text-theme-h">Save Favorite Geofence</h3>
                            </div>

                            <form onSubmit={handleCreateLocation} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Zone Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Clifton Office Head" 
                                        value={locName} 
                                        onChange={e => setLocName(e.target.value)} 
                                        className="w-full bg-theme-canvas border border-theme-border rounded-lg px-4 py-2.5 text-sm text-theme-h placeholder-theme-muted focus:outline-none focus:border-primary-red transition-all" 
                                        required 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs text-theme-muted font-semibold uppercase">Latitude</label>
                                        <input 
                                            type="number" 
                                            step="any" 
                                            placeholder="24.8607" 
                                            value={locLat} 
                                            onChange={e => setLocLat(e.target.value)} 
                                            className="w-full bg-theme-canvas border border-theme-border rounded-lg px-4 py-2.5 text-sm text-theme-h placeholder-theme-muted focus:outline-none focus:border-primary-red transition-all" 
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-theme-muted font-semibold uppercase">Longitude</label>
                                        <input 
                                            type="number" 
                                            step="any" 
                                            placeholder="67.0011" 
                                            value={locLon} 
                                            onChange={e => setLocLon(e.target.value)} 
                                            className="w-full bg-theme-canvas border border-theme-border rounded-lg px-4 py-2.5 text-sm text-theme-h placeholder-theme-muted focus:outline-none focus:border-primary-red transition-all" 
                                            required 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Radius Limit (meters)</label>
                                    <input 
                                        type="number" 
                                        placeholder="100" 
                                        value={locRadius} 
                                        onChange={e => setLocRadius(e.target.value)} 
                                        className="w-full bg-theme-canvas border border-theme-border rounded-lg px-4 py-2.5 text-sm text-theme-h placeholder-theme-muted focus:outline-none focus:border-primary-red transition-all" 
                                        required 
                                    />
                                </div>

                                <button 
                                    type="submit" 
                                    className="w-full bg-primary-red hover:bg-primary-red-hover text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-primary-red/10 mt-2 flex items-center justify-center gap-2 hover:scale-[1.01]"
                                >
                                    <Compass className="w-5 h-5" />
                                    <span>Register Location</span>
                                </button>
                            </form>
                        </div>

                        {/* List Saved Favorites */}
                        <div className="lg:col-span-2 glass-panel p-6">
                            <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-4">
                                <Compass className="w-5 h-5 text-primary-red" />
                                <h3 className="font-semibold text-theme-h">Active Registry Coordinates</h3>
                            </div>

                            {locations.length === 0 ? (
                                <div className="text-center py-16 text-theme-muted text-sm">
                                    No locations saved yet. Build one on the left.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {locations.map(l => (
                                        <div key={l.id} className="bg-theme-canvas/50 border border-theme-border p-4 rounded-xl flex items-center gap-4 transition-colors">
                                            <div className="w-10 h-10 rounded-lg bg-primary-red/10 border border-primary-red/20 flex items-center justify-center shrink-0">
                                                <Globe className="w-5 h-5 text-primary-red" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <h5 className="font-semibold text-theme-h text-sm truncate">{l.name}</h5>
                                                <p className="text-xs text-theme-muted mt-0.5">Radius limit: {l.radiusInMeters} meters</p>
                                                <p className="text-[10px] font-mono text-theme-muted truncate mt-1">{l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. TAB: TASKS BOARD */}
                {activeTab === "tasks" && (
                    <div className="space-y-6 animate-slide-up">
                        {/* Assign Task Form */}
                        <div className="glass-panel p-6">
                            <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-5">
                                <Plus className="w-5 h-5 text-primary-red" />
                                <h3 className="font-semibold text-theme-h">Create & Assign Workspace Task</h3>
                            </div>

                            <form onSubmit={handleAssignTask} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Task Title</label>
                                    <input 
                                        type="text" 
                                        placeholder="Task objective..." 
                                        value={taskTitle} 
                                        onChange={e => setTaskTitle(e.target.value)} 
                                        className="glass-input text-sm px-4 py-2.5" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Assign To</label>
                                    <select 
                                        value={taskAssignee} 
                                        onChange={e => setTaskAssignee(e.target.value)}
                                        className="glass-select text-sm py-2.5 pl-4"
                                    >
                                        <option value="">Select Employee...</option>
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>{e.fullName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Priority</label>
                                    <select 
                                        value={taskPriority} 
                                        onChange={e => setTaskPriority(e.target.value)}
                                        className="glass-select text-sm py-2.5 pl-4"
                                    >
                                        <option value={0}>Low Priority</option>
                                        <option value={1}>Medium Priority</option>
                                        <option value={2}>High Priority</option>
                                        <option value={3}>Critical Priority</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                                    <label className="text-xs text-theme-muted font-semibold uppercase">Task description</label>
                                    <input 
                                        type="text" 
                                        placeholder="Explain expectations..." 
                                        value={taskDesc} 
                                        onChange={e => setTaskDesc(e.target.value)} 
                                        className="glass-input text-sm px-4 py-2.5" 
                                    />
                                </div>
                                <div className="flex gap-3 md:col-span-1">
                                    <div className="space-y-2 flex-1">
                                        <label className="text-xs text-theme-muted font-semibold uppercase">Deadline</label>
                                        <input 
                                            type="datetime-local" 
                                            value={taskDeadline} 
                                            onChange={e => setTaskDeadline(e.target.value)} 
                                            className="glass-input text-sm px-4 py-2.5 text-gray-300" 
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

                        {/* Assigned Task Tracking Matrix */}
                        <div className="glass-panel p-6 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-theme-border/30 pb-4 mb-4">
                                <h3 className="font-semibold text-theme-h">Assigned Task Tracking Matrix</h3>
                                <span className="text-xs text-theme-muted">{tasks.length} total active tasks</span>
                            </div>

                            {tasks.length === 0 ? (
                                <div className="text-center py-16 text-theme-muted text-sm">
                                    No tasks assigned yet. Assign work to staff using form above.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="border-b border-theme-border/30 text-theme-muted text-xs uppercase font-semibold">
                                                <th className="py-3 px-3">Title & Desc</th>
                                                <th className="py-3 px-3">Assignee</th>
                                                <th className="py-3 px-3">Deadline & Priority</th>
                                                <th className="py-3 px-3">Progress State</th>
                                                <th className="py-3 px-3">Flagged Blockers</th>
                                                <th className="py-3 px-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tasks.map(t => (
                                                <tr key={t.id} className="border-b border-theme-border/20 text-theme-body hover:bg-theme-canvas/20">
                                                    <td className="py-4 px-3 max-w-[200px]">
                                                        <div className="font-semibold text-theme-h truncate">{t.title}</div>
                                                        <div className="text-xs text-theme-muted truncate mt-0.5">{t.description || "-"}</div>
                                                    </td>
                                                    <td className="py-4 px-3 text-xs font-semibold text-theme-h">
                                                        {t.assignedTo?.fullName || <span className="text-theme-muted">Unassigned</span>}
                                                    </td>
                                                    <td className="py-4 px-3 text-xs">
                                                        <div className="text-theme-muted">
                                                            {new Date(t.deadline).toLocaleDateString()}
                                                        </div>
                                                        <div className={`text-[10px] font-bold mt-1 ${
                                                            t.priority === 3 || t.priority === "Critical" ? "text-danger-rose" :
                                                            t.priority === 2 || t.priority === "High" ? "text-warning-yellow" :
                                                            t.priority === 0 || t.priority === "Low" ? "text-theme-muted" :
                                                            "text-info-blue"
                                                        }`}>
                                                            {t.priority === 3 ? "CRITICAL" : t.priority === 2 ? "HIGH" : t.priority === 0 ? "LOW" : "MEDIUM"}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-3">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded w-fit ${
                                                                t.assignmentStatus === "Accepted" ? "bg-success-bg text-success-green border border-success-border/30" : 
                                                                t.assignmentStatus === "Rejected" ? "bg-danger-bg text-danger-rose border border-danger-border/30 animate-pulse" : 
                                                                t.assignmentStatus === "ForceAssigned" ? "bg-info-bg text-info-blue border border-info-border/30" : 
                                                                "bg-warning-bg text-warning-yellow border border-warning-border/30"
                                                            }`}>
                                                                {t.assignmentStatus}
                                                            </span>
                                                            <span className="text-[11px] text-theme-muted font-semibold">
                                                                Progress: {t.progressStatus}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-3">
                                                        {t.blockers && t.blockers.length > 0 ? (
                                                            <div className="flex flex-col gap-1.5 max-w-[180px]">
                                                                {t.blockers.map(b => (
                                                                    <div key={b.id} className="text-[11px] bg-danger-bg/50 border border-danger-border/40 text-danger-rose px-2 py-1 rounded flex items-start gap-1">
                                                                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                                                                        <span className="line-clamp-2">{b.description}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-theme-muted">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-3 text-right">
                                                        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                                                            {t.assignmentStatus === "Rejected" && (
                                                                <button 
                                                                    onClick={() => handleForceAssign(t.id)} 
                                                                    className="bg-info-blue hover:bg-blue-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer shadow"
                                                                >
                                                                    Force Assign
                                                                </button>
                                                            )}
                                                            <div className="flex items-center gap-1.5">
                                                                <select 
                                                                    value={reassignTarget[t.id] || ""} 
                                                                    onChange={e => setReassignTarget({ ...reassignTarget, [t.id]: e.target.value })}
                                                                    className="glass-select text-[11px] py-1 pl-2 pr-6"
                                                                >
                                                                    <option value="">Reassign...</option>
                                                                    {employees.map(emp => (
                                                                        <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                                                                    ))}
                                                                </select>
                                                                <button 
                                                                    onClick={() => handleReassign(t.id)}
                                                                    className="p-1.5 bg-theme-card hover:bg-theme-canvas border border-theme-border rounded-lg text-theme-muted hover:text-theme-h transition-colors cursor-pointer"
                                                                >
                                                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleRemoveTask(t.id)} 
                                                                className="p-1.5 hover:bg-danger-bg rounded-lg text-theme-muted hover:text-danger-rose transition-colors cursor-pointer"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
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

                {/* 4. TAB: LEAVE PROCESSING */}
                {activeTab === "leaves" && (
                    <div className="glass-panel p-6 animate-slide-up overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-4">
                            <Calendar className="w-5 h-5 text-primary-red" />
                            <h3 className="font-semibold text-theme-h">Employee Leave Requests</h3>
                        </div>

                        {leaves.length === 0 ? (
                            <div className="text-center py-16 text-theme-muted text-sm">
                                No leave requests have been applied by managed employees.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-theme-border/30 text-theme-muted text-xs uppercase font-semibold">
                                            <th className="py-3 px-3">Employee Name</th>
                                            <th className="py-3 px-3">Leave Details</th>
                                            <th className="py-3 px-3">Duration</th>
                                            <th className="py-3 px-3">Status</th>
                                            <th className="py-3 px-3">Comments / Remarks</th>
                                            <th className="py-3 px-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaves.map(l => (
                                            <tr key={l.id} className="border-b border-theme-border/20 text-theme-body hover:bg-theme-canvas/20">
                                                <td className="py-4.5 px-3 font-semibold text-theme-h">{l.employeeName}</td>
                                                <td className="py-4.5 px-3 text-xs text-theme-muted">{l.leaveType} Leave</td>
                                                <td className="py-4.5 px-3 text-xs">
                                                    {new Date(l.startDate).toLocaleDateString()} <span className="text-theme-muted">to</span> {new Date(l.endDate).toLocaleDateString()}
                                                </td>
                                                <td className="py-4.5 px-3">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                        l.status === "Approved" ? "bg-success-bg text-success-green border border-success-border/30" : 
                                                        l.status === "Rejected" ? "bg-danger-bg text-danger-rose border border-danger-border/30" : 
                                                        "bg-warning-bg text-warning-yellow border border-warning-border/30"
                                                    }`}>
                                                        {l.status}
                                                    </span>
                                                </td>
                                                <td className="py-4.5 px-3">
                                                    {l.status === "Pending" ? (
                                                        <input 
                                                            type="text" 
                                                            placeholder="Comments or reason for decline..." 
                                                            value={leaveComments[l.id] || ""}
                                                            onChange={e => setLeaveComments({ ...leaveComments, [l.id]: e.target.value })}
                                                            className="glass-input text-xs px-4 py-1.5"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-theme-muted">{l.managerReason || "-"}</span>
                                                    )}
                                                </td>
                                                <td className="py-4.5 px-3 text-right">
                                                    {l.status === "Pending" && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                                onClick={() => handleProcessLeave(l.id, true)} 
                                                                className="bg-success-green hover:bg-emerald-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1"
                                                                title="Approve Request"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Approve</span>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleProcessLeave(l.id, false)} 
                                                                className="bg-danger-rose hover:bg-rose-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1"
                                                                title="Decline Request"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                <span>Reject</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 5. TAB: EMPLOYEE SELF-CREATED TASKS */}
                {activeTab === "empTasks" && (
                    <div className="glass-panel p-6 animate-slide-up overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-theme-border/30 pb-4 mb-4">
                            <ClipboardList className="w-5 h-5 text-primary-red" />
                            <h3 className="font-semibold text-theme-h">Tasks Created by Employees</h3>
                            <span className="ml-auto text-xs text-theme-muted">{employeeTasks.length} self-created tasks</span>
                        </div>

                        {employeeTasks.length === 0 ? (
                            <div className="text-center py-16 text-theme-muted text-sm">
                                No self-created tasks from your managed employees.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-theme-border/30 text-theme-muted text-xs uppercase font-semibold">
                                            <th className="py-3 px-3">Employee</th>
                                            <th className="py-3 px-3">Task Title & Description</th>
                                            <th className="py-3 px-3">Deadline</th>
                                            <th className="py-3 px-3">Priority</th>
                                            <th className="py-3 px-3">Progress</th>
                                            <th className="py-3 px-3">Blockers</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employeeTasks.map(t => (
                                            <tr key={t.id} className="border-b border-theme-border/20 text-theme-body hover:bg-theme-canvas/20">
                                                <td className="py-4 px-3">
                                                    <div className="font-semibold text-theme-h text-sm">{t.assignedTo?.fullName || "Unknown"}</div>
                                                    <div className="text-[10px] text-theme-muted uppercase tracking-wider mt-0.5">{t.assignedTo?.department || "-"}</div>
                                                </td>
                                                <td className="py-4 px-3 max-w-[250px]">
                                                    <div className="font-semibold text-theme-h truncate">{t.title}</div>
                                                    <div className="text-xs text-theme-muted truncate mt-0.5">{t.description || "-"}</div>
                                                </td>
                                                <td className="py-4 px-3 text-xs text-theme-muted">
                                                    {new Date(t.deadline).toLocaleDateString()}
                                                    <div className="text-[10px] mt-0.5">{new Date(t.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td className="py-4 px-3">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                                        t.priority === "Critical" ? "bg-danger-bg text-danger-rose border border-danger-border/30" :
                                                        t.priority === "High" ? "bg-warning-bg text-warning-yellow border border-warning-border/30" :
                                                        t.priority === "Low" ? "bg-theme-canvas text-theme-muted border border-theme-border" :
                                                        "bg-info-bg text-info-blue border border-info-border/30"
                                                    }`}>
                                                        {t.priority}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-3">
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                                        t.progressStatus === "Completed" ? "bg-success-bg text-success-green border border-success-border/30" :
                                                        t.progressStatus === "InProgress" ? "bg-info-bg text-info-blue border border-info-border/30" :
                                                        "bg-warning-bg text-warning-yellow border border-warning-border/30"
                                                    }`}>
                                                        {t.progressStatus === "InProgress" ? "In Progress" : t.progressStatus}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-3">
                                                    {t.blockers && t.blockers.length > 0 ? (
                                                        <div className="flex flex-col gap-1 max-w-[180px]">
                                                            {t.blockers.map(b => (
                                                                <div key={b.id} className="text-[11px] bg-danger-bg/50 border border-danger-border/40 text-danger-rose px-2 py-1 rounded flex items-start gap-1">
                                                                    <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                                                                    <span className="line-clamp-2">{b.description}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-theme-muted">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Nav Bar for Mobile screens */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-theme-card border-t border-theme-border/50 flex items-center justify-around py-2 safe-padding-bottom shadow-black/10 shadow-2xl select-none transition-colors duration-300">
                <button 
                    onClick={() => setActiveTab("team")}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                        activeTab === "team" ? "text-primary-red" : "text-theme-muted"
                    }`}
                >
                    <Users className="w-5 h-5" />
                    <span className="text-[10px] font-semibold mt-1">Team</span>
                </button>

                <button 
                    onClick={() => setActiveTab("locations")}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                        activeTab === "locations" ? "text-primary-red" : "text-theme-muted"
                    }`}
                >
                    <MapPin className="w-5 h-5" />
                    <span className="text-[10px] font-semibold mt-1">Geofences</span>
                </button>

                <button 
                    onClick={() => setActiveTab("tasks")}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl relative transition-all cursor-pointer ${
                        activeTab === "tasks" ? "text-primary-red" : "text-theme-muted"
                    }`}
                >
                    <Briefcase className="w-5 h-5" />
                    {totalBlockers > 0 && (
                        <span className="absolute top-0 right-2 w-2 h-2 bg-primary-red rounded-full ring-2 ring-theme-card"></span>
                    )}
                    <span className="text-[10px] font-semibold mt-1">Tasks</span>
                </button>

                <button 
                    onClick={() => setActiveTab("empTasks")}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl relative transition-all cursor-pointer ${
                        activeTab === "empTasks" ? "text-primary-red" : "text-theme-muted"
                    }`}
                >
                    <ClipboardList className="w-5 h-5" />
                    {employeeTasks.length > 0 && (
                        <span className="absolute top-0 right-2 w-2 h-2 bg-info-blue rounded-full ring-2 ring-theme-card"></span>
                    )}
                    <span className="text-[10px] font-semibold mt-1">Emp Tasks</span>
                </button>

                <button 
                    onClick={() => setActiveTab("leaves")}
                    className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl relative transition-all cursor-pointer ${
                        activeTab === "leaves" ? "text-primary-red" : "text-theme-muted"
                    }`}
                >
                    <Calendar className="w-5 h-5" />
                    {pendingLeavesCount > 0 && (
                        <span className="absolute top-0 right-2 w-2 h-2 bg-warning-yellow rounded-full ring-2 ring-theme-card"></span>
                    )}
                    <span className="text-[10px] font-semibold mt-1">Leaves</span>
                </button>
            </nav>
        </div>
    );
}
