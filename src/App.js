/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

  const loadAnnualBalances = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/annual-balances`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setAnnualBalances(data);
    } catch (err) {
      console.error("Error fetching balances:", err);
    }
  };
  
  React.useEffect(() => {
    loadAnnualBalances();
  }, []);

  const handleLogin = async (username, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (result.success) {
        setCurrentUser(result.user);
        setIsLoggedIn(true);

        await loadAnnualBalances();

        if (result.user.role === 'manager' || result.user.role === 'admin') {
          await loadVacationRequests();
        }
        return { success: true };
      } 
      else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Login failed:', err);
      return { success: false, error: 'Σφάλμα σύνδεσης. Παρακαλώ δοκιμάστε ξανά.' };
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        await loadDepartments();
        await loadUsers();
        await loadVacationRequests();
        await loadHolidays();
        await loadAnnualBalances();
        setLoading(false);
      } catch (err) {
        setError(`Failed to initialize application: ${err.message}`);
        setLoading(false);
      }
    };

    initApp();
  }, []);

  const loadDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/departments`);
      if (!response.ok) throw new Error('Failed to fetch departments');
      const depts = await response.json();
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load departments:', err);
      throw new Error('Could not load departments');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const users = await response.json();
      setUserDatabase(users);
    } catch (err) {
      console.error('Failed to load users:', err);
      throw new Error('Could not load users');
    }
  };

  const loadVacationRequests = async (managerId = null) => {
    try {
      const response = await fetch(`${API_BASE_URL}/vacation-requests`);
      if (!response.ok) throw new Error('Failed to fetch vacation requests');
      const requests = await response.json();
      setVacationRequests(requests);
    } catch (err) {
      console.error('Failed to load vacation requests:', err);
      throw new Error('Could not load vacation requests');
    }
  };

const AnnualBalancesTable = ({ annualBalances }) => {
  return (
    <table className="annual-balances-table">
      <thead>
        <tr>
          <th>User Name</th>
          <th>2024 (Remaining)</th>
          <th>2025 (Allocation)</th>
          <th>2026 (Upcoming)</th>
        </tr>
      </thead>
      <tbody>
        {annualBalances.map((user) => (
          <tr key={user.userId}>
            <td>{user.name}</td>
            <td>{user.balance_2024}</td>
            <td>{user.balance_2025}</td>
            <td>{user.balance_2026}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  const handleRequestSubmit = async (requestData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/vacation-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      const response = await fetch(`${API_BASE_URL}/vacation-requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: decision,
          reviewerId: currentUser.id,
          managerLevel: managerLevel || currentUser.manager_level || currentUser.managerLevel || 1
        })
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

  if (error) {
    return (
      <div className="min-h-screen bg-calm-blue-gradient flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-xl max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Σφάλμα Φόρτωσης</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="text-sm text-gray-500 mb-4">
            Βεβαιωθείτε ότι:
            <ul className="list-disc list-inside mt-2 text-left">
              <li>Το backend API server εκτελείται (port 3001)</li>
              <li>Η MySQL υπηρεσία εκτελείται</li>
              <li>Η βάση δεδομένων 'vacation_system' υπάρχει</li>
              <li>Οι πίνακες έχουν δημιουργηθεί σωστά</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ανανέωση Σελίδας
          </button>
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