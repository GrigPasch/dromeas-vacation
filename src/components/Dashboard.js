import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Users, Clock, Shield, LogOut, Gift, History, BarChart3 } from 'lucide-react';
import CalendarView from './CalendarView';
import RequestsView from './RequestsView';
import TeamView from './TeamView';
import ApprovalsView from './ApprovalsView';
import ManageDaysView from './ManageDaysView';
import UserInfoBar from './UserInfoBar';
import RequestModal from './RequestModal';
import { getUsedDaysByLeaveYear } from '../utils/vacationUtils';
import GrantedDaysHistory from './GrantedDaysHistory';
import YearlyBalanceView from './YearlyBalanceView'; 

const API_BASE_URL = 'http://localhost:3001/api';

const Dashboard = ({ 
  currentUser, 
  vacationRequests, 
  userDatabase,
  departments,
  holidays,
  annualBalances = [], 
  onLogout, 
  onRequestSubmit, 
  onRequestDecision,
  onReloadUsers
}) => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const tabContainerRef = useRef(null);
  const tabRefs = useRef([]);
  const isScrolling = useRef(false);
  
  const get2025Allowance = (balances, userId) => {
    if (!balances || !Array.isArray(balances) || balances.length === 0) return 0;

    const pivotedEntry = balances.find(b => Number(b.userId || b.user_id) === Number(userId));
    if (pivotedEntry && pivotedEntry.balance_2025 !== undefined) {
      return Number(pivotedEntry.balance_2025);
    }

    const rawEntry = balances.find(b => Number(b.cycle_start_year || b.year) === 2025);
    if (rawEntry && rawEntry.total_allowed !== undefined) {
      return Number(rawEntry.total_allowed);
    }

    return 0;
  };

  const usedDaysInCurrentCycle = useMemo(() => {
    const targetYear = 2025; 
    return getUsedDaysByLeaveYear(currentUser.id, vacationRequests, targetYear, holidays);
  }, [currentUser.id, vacationRequests, holidays]);
  
  const remainingDays = useMemo(() => {
    const allowance2025 = get2025Allowance(annualBalances, currentUser.id);
    return Math.max(0, allowance2025 - usedDaysInCurrentCycle);
  }, [currentUser.id, usedDaysInCurrentCycle, annualBalances]);
  
  const pendingApprovals = useMemo(() => {
    if (currentUser.role !== 'manager' || !vacationRequests || !Array.isArray(vacationRequests)) {
      return [];
    }
    const managerLevel = currentUser.managerLevel || currentUser.manager_level || 1;
    const filtered = vacationRequests.filter(req => {
      if (managerLevel === 1) {
        const userId = req.user_id || req.userId;
        const user = userDatabase.find(u => u.id === userId);
        
        if (!user) return false;
        
        const userManagerId = user.manager_id || user.managerId;
        const isPending = req.status === 'pending';
        const isDirectReport = userManagerId === currentUser.id;
        
        return isPending && isDirectReport;
      } else if (managerLevel === 2) {
        return req.status === 'manager1_approved';
      }
      return false;
    });
    return filtered;
  }, [currentUser, vacationRequests, userDatabase]);

  const handleRequestSubmit = async (requestData) => {
    const result = await onRequestSubmit(requestData);
    if (result.success) {
      setShowRequestForm(false);
    } else {
      alert(result.error || 'Αποτυχία υποβολής αίτησης');
    }
  };

  const handleRequestDecision = async (requestId, decision, managerLevel) => {
    const result = await onRequestDecision(requestId, decision, managerLevel);
    if (!result.success) {
      alert(result.error || 'Αποτυχία ενημέρωσης αίτησης');
    }
  };

  const handleGrantDays = async (grantData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/vacation-days/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: grantData.userIds,
          days: grantData.days,
          startDate: grantData.startDate,
          endDate: grantData.endDate,
          reason: grantData.reason,
          grantedBy: currentUser.id,
          isDeduction: grantData.isDeduction || false
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        if (onReloadUsers) {
          await onReloadUsers();
        }
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('Grant days failed:', err);
      return { success: false, error: 'Σφάλμα σύνδεσης. Παρακαλώ δοκιμάστε ξανά.' };
    }
  };

  const tabs = useMemo(() => [
    { id: 'calendar', label: 'Προβολή Ημερολογίου', icon: Calendar },
    { id: 'requests', label: 'Οι Αιτήσεις μου', icon: Clock },
    ...(currentUser.role === 'manager' 
      ? [
          { id: 'team', label: 'Επισκόπηση Αδειών Ομάδας', icon: Users },
          { id: 'manage-days', label: 'Καταχώρηση Άδειας', icon: Gift },
          { id: 'granted-history', label: 'Ιστορικό Χορηγήσεων', icon: History },
          { id: 'annual-view', label: 'Υπόλοιπα Ετών', icon: BarChart3 },
          { id: 'approvals', label: `Εγκρίσεις ${pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}`, icon: Shield }
        ]
      : []
    )
  ], [currentUser.role, pendingApprovals.length]);

  useEffect(() => {
    const container = tabContainerRef.current;
    if (!container) return;

    let scrollTimeout;
    const handleScroll = () => {
      if (isScrolling.current) return;
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const containerScrollLeft = container.scrollLeft;
        const containerWidth = container.offsetWidth;
        
        let closestIndex = 0;
        let smallestDistance = Infinity;

        tabRefs.current.forEach((tab, index) => {
          if (!tab) return;
          const tabLeft = tab.offsetLeft;
          const tabCenter = tabLeft + (tab.offsetWidth / 2);
          const containerCenter = containerScrollLeft + (containerWidth / 2);
          const distance = Math.abs(tabCenter - containerCenter);
          
          if (distance < smallestDistance) {
            closestIndex = index;
            smallestDistance = distance;
          }
        });

        const newActiveTab = tabs[closestIndex];
        if (newActiveTab?.id && newActiveTab.id !== activeTab) {
          setActiveTab(newActiveTab.id);
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [activeTab, tabs]);

  const handleTabClick = (id, index) => {
    setActiveTab(id);
    const container = tabContainerRef.current;
    const tab = tabRefs.current[index];
    
    if (container && tab) {
      isScrolling.current = true;
      const containerWidth = container.offsetWidth;
      const tabLeft = tab.offsetLeft;
      const tabWidth = tab.offsetWidth;
      const scrollPosition = tabLeft - (containerWidth / 2) + (tabWidth / 2);
      
      container.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });

      setTimeout(() => {
        isScrolling.current = false;
      }, 500);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'calendar':
        return (
          <CalendarView 
            vacationRequests={vacationRequests}
            userDatabase={userDatabase}
            departments={departments}
            currentUser={currentUser}
            holidays={holidays}
            onRequestTimeOff={() => setShowRequestForm(true)}
          />
        );
      case 'requests':
        return (
          <RequestsView 
            currentUser={currentUser}
            vacationRequests={vacationRequests}
            userDatabase={userDatabase}
            departments={departments}
            holidays={holidays}
          />
        );
      case 'team':
        if (currentUser.role !== 'manager') return null;
        return (
          <TeamView 
            userDatabase={userDatabase}
            vacationRequests={vacationRequests}
            departments={departments}
            holidays={holidays}
            annualBalances={annualBalances}
          />
        );
      case 'manage-days':
        if (currentUser.role !== 'manager') return null;
        return (
          <ManageDaysView 
            currentUser={currentUser}
            userDatabase={userDatabase}
            departments={departments}
            vacationRequests={vacationRequests}
            onGrantDays={handleGrantDays}
            holidays={holidays}
            annualBalances={annualBalances}
          />
        );
      case 'granted-history':
        if (currentUser.role !== 'manager') return null;
        return (
          <GrantedDaysHistory
            currentUser={currentUser}
            userDatabase={userDatabase}
            vacationRequests={vacationRequests}
            departments={departments}
            holidays={holidays}
          />
        );
      case 'annual-view':
        return currentUser.role === 'manager' ? (
          <YearlyBalanceView 
            annualBalances={annualBalances}
            userDatabase={userDatabase} 
            departments={departments}
            holidays={holidays}
          />
        ) : null;
      case 'approvals':
        if (currentUser.role !== 'manager') return null;
        return (
          <ApprovalsView 
            currentUser={currentUser}
            pendingRequests={pendingApprovals}
            userDatabase={userDatabase}
            departments={departments}
            holidays={holidays}
            onRequestDecision={handleRequestDecision}
          />
        );
      default:
        return null;
    }
  };

  const userDepartment = departments.find(dept => dept.id === currentUser.departmentId);

  return (
    <div className="min-h-screen bg-calm-blue-gradient">
      <div className="container mx-auto p-6 xs:p-4">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-calm-green-gradient p-6 xs:p-4 text-white">
            <div className="flex items-center justify-between xs:flex-col xs:gap-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-8 w-8 xs:h-7 xs:w-7 text-black" />
                <div>
                  <h1 className="text-2xl xs:text-lg text-black font-bold">Ημερολόγιο Αδειών</h1>
                  <p className="opacity-90 text-black xs:text-sm">Διαχείριση Αδειών.</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 xs:flex-col xs:gap-3 xs:w-full">
                <div className="flex items-center space-x-2 xs:justify-center">
                  {currentUser.role === 'manager' && <Shield className="h-4 w-4 text-black" />}
                  <div className="text-right xs:text-center">
                    <p className="font-medium text-black xs:text-sm xs:font-bold">{currentUser.name}</p>
                    <div className="flex items-center space-x-2 xs:justify-center">
                      <p className="text-xs text-black opacity-75">
                        {currentUser.role === 'manager' ? 'Διαχειριστής' : 'Υπάλληλος'}
                      </p>
                      {userDepartment && (
                        <>
                          <span className="text-xs text-black opacity-75">•</span>
                          <div className="flex items-center space-x-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: userDepartment.color }}
                            ></div>
                            <p className="text-xs text-black opacity-75">{userDepartment.name}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center border-2 border-black space-x-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors xs:w-full xs:justify-center"
                >
                  <LogOut className="h-4 w-4 text-black" />
                  <span className='text-black'>Αποσύνδεση</span>
                </button>
              </div>
            </div>
          </div>
          <div className="border-b border-gray-200">
            <nav
              ref={tabContainerRef}
              className="overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth sm:flex sm:space-x-8 sm:px-6"
            >
              <div className="flex xs:w-max sm:space-x-8">
                {tabs.map(({ id, label, icon: Icon }, index) => (
                  <button
                    key={id}
                    ref={(el) => (tabRefs.current[index] = el)}
                    onClick={() => handleTabClick(id, index)}
                    style={{ scrollSnapAlign: 'center' }}
                    className={`
                      flex items-center space-x-2 py-4 border-b-2 transition-colors
                      sm:flex-row
                      xs:min-w-[100vw] xs:snap-center xs:flex-col xs:justify-center xs:snap-always
                      ${activeTab === id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500'}
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="xs:text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </nav>
          </div>
          <div className="p-6 xs:p-4">
            <UserInfoBar
              currentUser={currentUser}
              usedDays={usedDaysInCurrentCycle}
              remainingDays={remainingDays}
              department={userDepartment}
              vacationRequests={vacationRequests}
              holidays={holidays}
              annualBalances={annualBalances}
            />
            {renderActiveTab()}
          </div>
        </div>
        {showRequestForm && (
          <RequestModal
            currentUser={currentUser}
            existingRequests={vacationRequests}
            holidays={holidays}
            annualBalances={annualBalances}
            onSubmit={handleRequestSubmit}
            onClose={() => setShowRequestForm(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;