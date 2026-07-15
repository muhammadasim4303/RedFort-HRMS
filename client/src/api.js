const API_BASE = "http://localhost:3000/api/v1";

export const getAuthToken = () => localStorage.getItem("token");
export const setAuthToken = (token) => localStorage.setItem("token", token);
export const clearAuth = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};
export const getUser = () => JSON.parse(localStorage.getItem("user"));
export const setUser = (user) => localStorage.setItem("user", JSON.stringify(user));

const request = async (url, options = {}) => {
    const token = getAuthToken();
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
    });
    if (response.status === 401) {
        if (url !== "/auth/login") {
            clearAuth();
            window.location.href = "/login";
            throw new Error("Session expired. Please log in again.");
        }
    }
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API Error: ${response.status}`);
    }
    return response.json().catch(() => ({}));
};

export const api = {
    login: (email, password) => request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    }),
    register: (userData) => request("/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
    }),
    
    // Locations
    createLocation: (locData) => request("/locations", {
        method: "POST",
        body: JSON.stringify(locData),
    }),
    getLocations: () => request("/locations"),
    assignLocation: (employeeId, locationId) => request("/locations/assign", {
        method: "POST",
        body: JSON.stringify({ employeeId, locationId }),
    }),

    // Attendance
    checkIn: (lat, lon, isOnsite) => request("/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ latitude: lat, longitude: lon, isOnsite }),
    }),
    checkOut: (lat, lon) => request("/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({ latitude: lat, longitude: lon }),
    }),
    getAttendanceStatus: () => request("/attendance/status"),
    getAttendanceHistory: () => request("/attendance/history"),

    // Tasks
    selfCreateTask: (taskData) => request("/tasks/self-create", {
        method: "POST",
        body: JSON.stringify(taskData),
    }),
    assignTask: (taskData) => request("/tasks/assign", {
        method: "POST",
        body: JSON.stringify(taskData),
    }),
    respondToTask: (taskId, accept, rejectionReason) => request(`/tasks/${taskId}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept, rejectionReason }),
    }),
    forceAssignTask: (taskId) => request(`/tasks/${taskId}/force-assign`, {
        method: "POST",
    }),
    reassignTask: (taskId, assignedToId) => request(`/tasks/${taskId}/reassign`, {
        method: "PUT",
        body: JSON.stringify({ assignedToId }),
    }),
    removeTask: (taskId) => request(`/tasks/${taskId}`, {
        method: "DELETE",
    }),
    updateTaskProgress: (taskId, progressStatus) => request(`/tasks/${taskId}/progress`, {
        method: "PUT",
        body: JSON.stringify({ progressStatus }),
    }),
    getTasks: () => request("/tasks"),
    reportBlocker: (taskId, description) => request("/blockers", {
        method: "POST",
        body: JSON.stringify({ taskId, description }),
    }),
    getBlockers: (taskId) => request(`/blockers/task/${taskId}`),

    // Leaves
    applyLeave: (leaveData) => request("/leaves", {
        method: "POST",
        body: JSON.stringify(leaveData),
    }),
    getLeaves: () => request("/leaves"),
    processLeave: (leaveId, status, managerReason) => request(`/leaves/${leaveId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, managerReason }),
    }),

    // Employees (for Managers/Admins)
    getEmployees: () => request("/employees"),
    getEmployeeHistory: (employeeId) => request(`/employees/${employeeId}/history`),
    getEmployeeSelfCreatedTasks: () => request("/tasks/employee-created"),
};
