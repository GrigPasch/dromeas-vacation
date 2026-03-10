/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002/api';

const getToken = () => localStorage.getItem('auth_token');
const setToken = (token) => localStorage.setItem('auth_token', token);
const clearToken = () => localStorage.removeItem('auth_token');

const authFetch = (url, options = {}) => {
  const token = getToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vacationRequests, setVacationRequests] = useState([]);
  const [userDatabase, setUserDatabase] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [annualBalances, setAnnualBalances] = useState([]);

  useEffect(() => {
    const initApp = async () => {
      try {
        await loadHolidays();

        const token = getToken();
        const savedUser = localStorage.getItem('current_user');

        if (token && savedUser) {
          const response = await authFetch(`${API_BASE_URL}/departments`);
          if (response.status === 401) {
            clearToken();
            localStorage.removeItem('current_user');
          } else {
            const depts = await response.json();
            setDepartments(depts);
            await loadUsers();
            await loadVacationRequests();
            await loadAnnualBalances();
            setCurrentUser(JSON.parse(savedUser));
            setIsLoggedIn(true);
          }
        }

        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  const loadAnnualBalances = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/annual-balances`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAnnualBalances(data);
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/departments`);
      if (!response.ok) throw new Error('Failed to fetch departments');
      const depts = await response.json();
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const users = await response.json();
      setUserDatabase(users);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadVacationRequests = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/vacation-requests`);
      if (!response.ok) throw new Error('Failed to fetch vacation requests');
      const requests = await response.json();
      setVacationRequests(requests);
    } catch (err) {
      console.error('Failed to load vacation requests:', err);
    }
  };

  const loadHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const response = await fetch(`${API_BASE_URL}/holidays?year=${currentYear}`);
      if (!response.ok) throw new Error('Failed to fetch holidays');
      const holidayData = await response.json();
      setHolidays(holidayData);
    } catch (err) {
      console.error('Failed to load holidays:', err);
      setHolidays([]);
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (result.success) {
        setToken(result.token);
        localStorage.setItem('current_user', JSON.stringify(result.user));

        setCurrentUser(result.user);
        setIsLoggedIn(true);

        await loadDepartments();
        await loadUsers();
        await loadVacationRequests();
        await loadAnnualBalances();

        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Login failed:', err);
      return { success: false, error: 'Σφάλμα σύνδεσης. Παρακαλώ δοκιμάστε ξανά.' };
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('current_user');
    setCurrentUser(null);
    setIsLoggedIn(false);
    setVacationRequests([]);
    setUserDatabase([]);
    setDepartments([]);
    setAnnualBalances([]);
  };

  const handleRequestSubmit = async (requestData) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/vacation-requests`, {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser.id,
          startDate: requestData.startDate,
          endDate: requestData.endDate,
          reason: requestData.reason,
          leaveType: requestData.leaveType || 'vacation',
        }),
      });

      const result = await response.json();

      if (result.success) {
        await loadVacationRequests();
        await loadAnnualBalances();
        return { success: true, requestId: result.requestId };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Failed to submit vacation request:', err);
      return { success: false, error: 'Αποτυχία υποβολής αίτησης. Παρακαλώ δοκιμάστε ξανά.' };
    }
  };

  const handleRequestDecision = async (requestId, decision, managerLevel) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/vacation-requests/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: decision,
          reviewerId: currentUser.id,
          managerLevel: managerLevel || currentUser.manager_level || currentUser.managerLevel || 1,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await loadVacationRequests();
        await loadAnnualBalances();
      }
      return result;
    } catch (err) {
      console.error('Failed to process request decision:', err);
      return { success: false, error: 'Αποτυχία ενημέρωσης αίτησης. Παρακαλώ δοκιμάστε ξανά.' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-blue-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Φόρτωση Εφαρμογής...</h2>
          <p className="text-gray-600">Σύνδεση με API Server</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <Dashboard
      currentUser={currentUser}
      vacationRequests={vacationRequests}
      userDatabase={userDatabase}
      departments={departments}
      holidays={holidays}
      annualBalances={annualBalances}
      onLogout={handleLogout}
      onRequestSubmit={handleRequestSubmit}
      onRequestDecision={handleRequestDecision}
      onReloadUsers={loadUsers}
    />
  );
};

export default App;
