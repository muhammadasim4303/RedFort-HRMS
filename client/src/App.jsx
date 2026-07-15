import React, { useState, useEffect } from "react";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import { getUser } from "./api";

function App() {
    const [user, setUser] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

    useEffect(() => {
        const storedUser = getUser();
        if (storedUser) {
            setUser(storedUser);
        }
    }, []);

    useEffect(() => {
        if (theme === "light") {
            document.documentElement.classList.add("light");
        } else {
            document.documentElement.classList.remove("light");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    const handleLoginSuccess = (loggedInUser) => {
        setUser(loggedInUser);
    };

    if (!user) {
        return <Login onLogin={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />;
    }

    // Role-based dashboard selection
    // Support both enum indices (0,1,2,3) and text representation strings
    if (user.role === "SuperAdmin" || user.role === 0) {
        return <AdminDashboard theme={theme} toggleTheme={toggleTheme} />;
    } else if (user.role === "LineManager" || user.role === 1) {
        return <ManagerDashboard theme={theme} toggleTheme={toggleTheme} />;
    } else if (user.role === "Employee" || user.role === "Intern" || user.role === 2 || user.role === 3) {
        return <EmployeeDashboard theme={theme} toggleTheme={toggleTheme} />;
    }

    return (
        <div style={{ padding: "20px" }} className="min-h-screen bg-theme-canvas text-theme-body flex flex-col items-center justify-center">
            <h2 className="text-theme-h">Welcome, {user.fullName}</h2>
            <p className="text-theme-muted">Role unknown or unauthorized. Please contact administrator.</p>
            <div className="flex gap-4 mt-4">
                <button 
                    onClick={toggleTheme}
                    className="px-4 py-2 border border-theme-border rounded-xl text-theme-muted hover:text-theme-h"
                >
                    Toggle Theme
                </button>
                <button 
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="px-4 py-2 bg-primary-red text-white rounded-xl"
                >
                    Reset Session
                </button>
            </div>
        </div>
    );
}

export default App;
