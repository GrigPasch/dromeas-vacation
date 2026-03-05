/* eslint-disable no-lone-blocks */
import React, { useState, useEffect } from 'react';
import DepartmentFilter from './DepartmentFilter';
import { isGreekHoliday, getLeaveTypeInfo } from '../utils/vacationUtils';

const CalendarView = ({ 
  vacationRequests = [], 
  userDatabase = [], 
  departments = [], 
  onRequestTimeOff,
  currentUser,
  holidays = [] 
}) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDepartments, setSelectedDepartments] = useState(
    departments.map(dept => dept.id)
  );
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 653);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getFilteredVacationRequests = () => {
    if (!vacationRequests || !Array.isArray(vacationRequests)) {
      return [];
    }
    
    if (!currentUser) {
      return [];
    }
    
    if (currentUser.role === 'manager') {
      return vacationRequests.filter(req => {
        const userId = req.user_id || req.userId;
        const user = userDatabase.find(u => u.id === userId);
        const userDeptId = user?.department_id || user?.departmentId;
        return user && selectedDepartments.includes(userDeptId) && req.status === 'approved';
      });
    } else {
      return vacationRequests.filter(req => {
        const userId = req.user_id || req.userId;
        return userId === currentUser.id && req.status === 'approved';
      });
    }
  };

  const filteredVacationRequests = getFilteredVacationRequests();

  const getCalendarData = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startingDayOfWeek = firstDay.getDay();
    startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const vacationsOnThisDay = filteredVacationRequests.filter(req => {
        const startDate = new Date(req.start_date || req.startDate);
        const endDate = new Date(req.end_date || req.endDate);
        const currentDate = new Date(dateStr);
        
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);
        
        return currentDate >= startDate && currentDate <= endDate;
      });
      
      const holiday = isGreekHoliday(dateStr, holidays);
      
      days.push({
        day,
        date: dateStr,
        vacations: vacationsOnThisDay,
        holiday
      });
    }
    
    return { 
      days, 
      monthName: firstDay.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' }) 
    };
  };

  const { days, monthName } = getCalendarData();
  const dayNames = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prevYear => prevYear + 1);
    } else {
      setCurrentMonth(prevMonth => prevMonth + 1);
    }
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prevYear => prevYear - 1);
    } else {
      setCurrentMonth(prevMonth => prevMonth - 1);
    }
  };

  const getDepartmentByUserId = (userId) => {
    const user = userDatabase.find(u => u.id === userId);
    if (!user) return null;
    
    const departmentId = user.department_id || user.departmentId;
    return departments.find(dept => dept.id === departmentId);
  };

  if (!currentUser) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Φόρτωση...</p>
      </div>
    );
  }
  {/* Mobile List View */}
  if (isMobile) {
    const upcomingLeaves = filteredVacationRequests
      .filter(req => new Date(req.start_date || req.startDate) >= today)
      .sort((a, b) => {
        const dateA = new Date(a.start_date || a.startDate);
        const dateB = new Date(b.start_date || b.startDate);
        return dateA - dateB;
      });

    return (
      <div>
        <div className="flex items-center justify-between mb-6 xs:flex-col xs:gap-4">
          <h2 className="text-xl font-semibold text-gray-800">
            {currentUser.role === 'manager' ? 'Επερχόμενες Άδειες Ομάδας' : 'Οι Επερχόμενες Άδειες μου'}
          </h2>
          <button
            onClick={onRequestTimeOff}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            + Νέα Άδεια
          </button>
        </div>

        {upcomingLeaves.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Δεν υπάρχουν επερχόμενες εγκεκριμένες άδειες</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingLeaves.map(leave => {
              const userId = leave.user_id || leave.userId;
              const user = userDatabase.find(u => u.id === userId);
              const department = getDepartmentByUserId(userId);
              const leaveType = leave.leave_type || leave.leaveType || 'vacation';
              const leaveTypeInfo = getLeaveTypeInfo(leaveType);
              const startDate = new Date(leave.start_date || leave.startDate);
              const endDate = new Date(leave.end_date || leave.endDate);
              const daysUntil = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));

              return (
                <div 
                  key={leave.id}
                  className="bg-white border-l-4 rounded-lg p-4 shadow-sm"
                  style={{ borderLeftColor: leaveTypeInfo.color }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      {currentUser.role === 'manager' && (
                        <div className="flex items-center space-x-2 mb-1">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: department?.color || '#3B82F6' }}
                          >
                            {(user?.name || '').split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium text-gray-800">{user?.name}</span>
                        </div>
                      )}
                      <div 
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium mb-2"
                        style={{ 
                          backgroundColor: `${leaveTypeInfo.color}20`,
                          color: leaveTypeInfo.color 
                        }}
                      >
                        <span>{leaveTypeInfo.icon}</span>
                        <span>{leaveTypeInfo.label}</span>
                      </div>
                    </div>
                    {daysUntil === 0 ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        Σήμερα!
                      </span>
                    ) : daysUntil <= 7 ? (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                        Σε {daysUntil} ημέρες
                      </span>
                    ) : null}
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">
                      {startDate.toLocaleDateString('el-GR', { day: 'numeric', month: 'long' })} - {endDate.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{leave.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  { /* Desktop Calendar View */}
  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={goToPreviousMonth}
            className="bg-calm-green-gradient-25 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            {'<'} Προηγούμενος Μήνας
          </button>
          
          <h2 className="text-xl font-semibold text-gray-800">{monthName}</h2>

          <button
            onClick={goToNextMonth}
            className="bg-calm-green-gradient-25 text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Επόμενος Μήνας {'>'}
          </button>
        </div>

        <div className="flex items-center space-x-4">
          {currentUser.role === 'manager' && (
            <DepartmentFilter
              departments={departments}
              selectedDepartments={selectedDepartments}
              onDepartmentChange={setSelectedDepartments}
              className="min-w-[200px]"
            />
          )}
          
          <button
            onClick={onRequestTimeOff}
            className="flex items-center space-x-2 bg-calm-green-gradient-25 text-black font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <span>Ζητήστε Άδεια</span>
          </button>
        </div>
      </div>
      
      {currentUser.role === 'manager' && selectedDepartments.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Τμήματα:</h4>
          <div className="flex flex-wrap gap-2">
            {departments
              .filter(dept => selectedDepartments.includes(dept.id))
              .map(department => (
                <div
                  key={department.id}
                  className="flex items-center space-x-2 px-2 py-1 bg-white rounded border"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: department.color }}
                  ></div>
                  <span className="text-xs text-gray-600">{department.name}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {currentUser.role !== 'manager' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Εμφανίζονται μόνο οι δικές σας εγκεκριμένες άδειες
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-calm-green-gradient-25">
          {dayNames.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => (
            <div 
              key={index} 
              className={`min-h-[100px] p-2 border-r border-b border-gray-300 last:border-r-0 ${
                day?.holiday ? 'bg-red-50' : ''
              }`}
            >
              {day && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium ${day.holiday ? 'text-red-600' : 'text-gray-800'}`}>
                      {day.day}
                    </span>
                    {day.holiday && (
                      <span className="text-red-500 text-xs" title={day.holiday.holiday_name}>
                        🎉
                      </span>
                    )}
                  </div>
                  {day.holiday && (
                    <div className="text-xs text-red-600 font-medium mb-1 truncate" title={day.holiday.holiday_name}>
                      {day.holiday.holiday_name}
                    </div>
                  )}
                  {day.vacations.map(vacation => {
                    const userId = vacation.userId || vacation.user_id;
                    const user = userDatabase.find(u => u.id === userId);
                    const leaveType = vacation.leave_type || vacation.leaveType || 'vacation';
                    const leaveTypeInfo = getLeaveTypeInfo(leaveType);
                    
                    const displayName = currentUser.role === 'manager' 
                      ? (user?.name || user?.user_name)
                      : 'Η άδειά μου';
                    
                    return (
                      <div
                        key={vacation.id}
                        className="text-xs px-2 py-1 rounded mb-1 truncate flex items-center space-x-1"
                        style={{ 
                          backgroundColor: leaveTypeInfo.color,
                          color: 'white'
                        }}
                        title={`${displayName} - ${leaveTypeInfo.label} - ${vacation.reason}`}
                      >
                        <span>{leaveTypeInfo.icon}</span>
                        <span className="flex-1 truncate text-white">{displayName}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-700">
            {currentUser.role === 'manager' ? 'Συνολικές Εγκρίσεις Μήνα' : 'Οι Εγκρίσεις μου τον Μήνα'}
          </h4>
          <p className="text-2xl font-bold text-green-600">
            {filteredVacationRequests.filter(req => {
              const startDate = req.start_date || req.startDate;
              const date = new Date(startDate);
              return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            }).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-700">Εκκρεμείς Αιτήσεις</h4>
          <p className="text-2xl font-bold text-yellow-600">
            {vacationRequests.filter(req => {
              const userId = req.user_id || req.userId;
              if (currentUser.role === 'manager') {
                const user = userDatabase.find(u => u.id === userId);
                const userDeptId = user?.department_id || user?.departmentId;
                return selectedDepartments.includes(userDeptId) && req.status === 'pending';
              } else {
                return userId === currentUser.id && req.status === 'pending';
              }
            }).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-700">Αργίες Μήνα</h4>
          <p className="text-2xl font-bold text-red-600">
            {holidays.filter(h => {
              const hDate = new Date(h.holiday_date);
              return hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear;
            }).length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;