import React, { useState } from 'react';
import { CalendarOff, Check, AlertTriangle, Calendar } from 'lucide-react';
import { getUsedDaysByLeaveYear } from '../utils/vacationUtils';
import DatePicker, { registerLocale } from 'react-datepicker';
import el from 'date-fns/locale/el';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('el', el);

const ManageDaysView = ({ currentUser, userDatabase, departments, onGrantDays, vacationRequests, annualBalances = [] }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reason, setReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [usersExceedingLimit, setUsersExceedingLimit] = useState([]);
  
  if (currentUser.role !== 'manager') {
    return null;
  }

  const allEmployees = userDatabase.filter(u => u.role !== 'manager');

  const dateToISOString = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const publicHolidays = [
    '2024-01-01', '2024-01-06', '2024-03-18', '2024-03-25', '2024-05-01',
    '2024-05-03', '2024-05-04', '2024-05-05', '2024-05-06', '2024-08-15',
    '2024-10-28', '2024-12-25', '2024-12-26',
    '2025-01-01', '2025-01-06', '2025-03-03', '2025-03-25', '2025-04-18',
    '2025-04-21', '2025-04-25', '2025-05-01', '2025-06-09', '2025-08-15',
    '2025-10-28', '2025-12-25', '2025-12-26',
    '2026-01-01', '2026-01-06', '2026-02-23', '2026-03-25', '2026-04-10',
    '2026-04-11', '2026-04-12', '2026-04-13', '2026-05-01', '2026-06-01',
    '2026-08-15', '2026-10-28', '2026-12-25', '2026-12-26'
  ];

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isPublicHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return publicHolidays.includes(dateStr);
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    if (end < start) return 0;

    let workingDays = 0;
    const currentDate = new Date(start);

    while (currentDate <= end) {
      if (!isWeekend(currentDate) && !isPublicHoliday(currentDate)) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  };

  const days = calculateDays();

  const handleUserToggle = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === allEmployees.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(allEmployees.map(u => u.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      alert('Παρακαλώ επιλέξτε τουλάχιστον έναν υπάλληλο');
      return;
    }

    if (!startDate || !endDate) {
      alert('Παρακαλώ επιλέξτε ημερομηνίες έναρξης και λήξης');
      return;
    }

    if (days <= 0) {
      alert('Παρακαλώ επιλέξτε έγκυρο εύρος ημερομηνιών');
      return;
    }

    if (!reason.trim()) {
      alert('Παρακαλώ εισάγετε αιτιολογία');
      return;
    }

    const usersWithIssues = [];
    const targetYear = 2025;
    
    selectedUsers.forEach(userId => {
      const user = allEmployees.find(u => u.id === userId);
      if (user) {
        const userUsedDays = vacationRequests ? getUsedDaysByLeaveYear(user.id, vacationRequests, targetYear) : 0;
        let userTotalDays = 0;
        
        if (annualBalances && annualBalances.length > 0) {
          const pivotedEntry = annualBalances.find(b => Number(b.userId || b.user_id) === Number(user.id));
          if (pivotedEntry && pivotedEntry.balance_2025 !== undefined) {
            userTotalDays = Number(pivotedEntry.balance_2025);
          }
          else {
            const rawEntry = annualBalances.find(b => Number(b.cycle_start_year || b.year) === targetYear);
            if (rawEntry && rawEntry.total_allowed !== undefined) {
              userTotalDays = Number(rawEntry.total_allowed);
            }
          }
        }
        
        const userGrantedDays = vacationRequests
          ? vacationRequests
              .filter(req => {
                const reqUserId = req.user_id || req.userId;
                const isManagerGranted = req.manager_granted || req.managerGranted;
                return reqUserId === user.id && req.status === 'approved' && isManagerGranted;
              })
              .reduce((total, req) => {
                const startDateField = req.start_date || req.startDate;
                const endDateField = req.end_date || req.endDate;
                if (!startDateField || !endDateField) return total;
                const start = new Date(startDateField);
                const end = new Date(endDateField);
                const reqDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
                return total + reqDays;
              }, 0)
          : 0;
        
        const userRemainingDays = Math.max(0, userTotalDays - userUsedDays - userGrantedDays);
        
        if (days > userRemainingDays) {
          usersWithIssues.push({
            name: user.name,
            remaining: userRemainingDays,
            exceeding: days - userRemainingDays
          });
        }
      }
    });

    if (usersWithIssues.length > 0) {
      setUsersExceedingLimit(usersWithIssues);
      setShowWarningModal(true);
      return;
    }

    await proceedWithGrant();
  };

  const proceedWithGrant = async () => {
    const result = await onGrantDays({
      userIds: selectedUsers,
      days: days,
      startDate: dateToISOString(startDate),
      endDate: dateToISOString(endDate),
      reason: reason.trim(),
      isDeduction: true
    });

    if (result.success) {
      setShowSuccess(true);
      setSelectedUsers([]);
      setStartDate(null);
      setEndDate(null);
      setReason('');
      setShowWarningModal(false);
      setUsersExceedingLimit([]);
      setTimeout(() => setShowSuccess(false), 3000);
    } else {
      alert(result.error || 'Αποτυχία καταχώρησης');
    }
  };

  const getDepartmentById = (deptId) => {
    return departments.find(d => d.id === deptId);
  };

  const groupedEmployees = departments.map(dept => ({
    department: dept,
    employees: allEmployees.filter(u => (u.department_id || u.departmentId) === dept.id)
  })).filter(group => group.employees.length > 0);
  
  return (
    <div>
      <div className="flex items-center justify-between mb-6 xs:mb-4">
        <div>
          <h2 className="text-xl xs:text-lg font-semibold text-gray-800 xs:text-sm">Καταχώρηση Υποχρεωτικής Άδειας</h2>
        </div>
        <CalendarOff className="h-8 w-8 xs:h-6 xs:w-6 text-blue-600" />
      </div>
      {showSuccess && (
        <div className="mb-4 p-4 xs:p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-800">
          <Check className="h-5 w-5 xs:h-4 xs:w-4 flex-shrink-0" />
          <span className="text-sm xs:text-xs">Η άδεια καταχωρήθηκε επιτυχώς!</span>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xs:gap-4">
        {/* Left side - User selection */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border p-4 xs:p-3">
            <div className="flex items-center justify-between mb-4 xs:mb-3">
              <h3 className="font-semibold text-gray-800 xs:text-sm">
                Επιλογή Υπαλλήλων ({selectedUsers.length})
              </h3>
              <button
                onClick={handleSelectAll}
                className="px-3 py-1 xs:px-2 xs:py-0.5 text-sm xs:text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {selectedUsers.length === allEmployees.length ? 'Απεπιλογή όλων' : 'Επιλογή όλων'}
              </button>
            </div>
            <div className="space-y-4 xs:space-y-3 max-h-[60vh] overflow-y-auto">
              {groupedEmployees.map(({ department, employees }) => (
                <div key={department.id}>
                  <div className="flex items-center space-x-2 mb-2">
                    <div
                      className="w-3 h-3 xs:w-2 xs:h-2 rounded-full"
                      style={{ backgroundColor: department.color }}
                    ></div>
                    <h4 className="font-medium text-gray-700 text-sm xs:text-xs">{department.name}</h4>
                    <span className="text-xs xs:text-[10px] text-gray-500">
                      ({employees.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {employees.map(user => {
                      const userDept = getDepartmentById(user.department_id || user.departmentId);
                      const isSelected = selectedUsers.includes(user.id);
                      const targetYear = 2025;
                      const userUsedDays = vacationRequests ? getUsedDaysByLeaveYear(user.id, vacationRequests, targetYear) : 0;
                      
                      let userTotalDays = 0;
                      if (annualBalances && annualBalances.length > 0) {
                        const pivotedEntry = annualBalances.find(b => Number(b.userId || b.user_id) === Number(user.id));
                        if (pivotedEntry && pivotedEntry.balance_2025 !== undefined) {
                          userTotalDays = Number(pivotedEntry.balance_2025);
                          } 
                        else {
                          const rawEntry = annualBalances.find(b => Number(b.cycle_start_year || b.year) === targetYear);
                          if (rawEntry && rawEntry.total_allowed !== undefined) {
                            userTotalDays = Number(rawEntry.total_allowed);
                          }
                        }
                      }
                      const userGrantedForList = vacationRequests
                        ? vacationRequests
                            .filter(req => {
                              const reqUserId = req.user_id || req.userId;
                              const isManagerGranted = req.manager_granted || req.managerGranted;
                              return reqUserId === user.id && req.status === 'approved' && isManagerGranted;
                            })
                            .reduce((total, req) => {
                              const startDateField = req.start_date || req.startDate;
                              const endDateField = req.end_date || req.endDate;
                              if (!startDateField || !endDateField) return total;
                              const start = new Date(startDateField);
                              const end = new Date(endDateField);
                              const reqDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
                              return total + reqDays;
                            }, 0)
                        : 0;
                      const userRemainingDays = Math.max(0, userTotalDays - userUsedDays - userGrantedForList);
                      return (
                        <label
                          key={user.id}
                          className={`group relative flex items-center space-x-3 xs:space-x-2 p-3 xs:p-2 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleUserToggle(user.id)}
                            className="w-4 h-4 xs:w-3 xs:h-3 text-blue-600 rounded"
                          />
                          <div
                            className="w-8 h-8 xs:w-6 xs:h-6 rounded-full flex items-center justify-center text-white font-semibold text-xs xs:text-[10px] flex-shrink-0"
                            style={{ backgroundColor: userDept?.color || '#3B82F6' }}
                          >
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm xs:text-xs truncate">
                              {user.name}
                            </p>
                            <p className="text-xs xs:text-[10px] text-gray-500 truncate">
                              {user.email}
                            </p>
                          </div>                         
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            Διαθέσιμες (2025): {userRemainingDays} {userRemainingDays === 1 ? 'ημέρα' : 'ημέρες'}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Right side - Date range and reason */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border p-4 xs:p-3 space-y-4 xs:space-y-3 sticky top-4">
            <h3 className="font-semibold text-gray-800 xs:text-sm">Λεπτομέρειες Άδειας</h3>
            {/* Date Range Selection */}
            <div className="space-y-3">
              <div>
                <label className="text-sm xs:text-xs font-medium text-gray-700 mb-2 flex items-center space-x-1">
                  <Calendar className="h-4 w-4 xs:h-3 xs:w-3" />
                  <span>Ημερομηνία Έναρξης *</span>
                </label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  locale="el"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Επιλέξτε ημερομηνία"
                  className="w-full px-3 py-2 xs:px-2 xs:py-1.5 text-sm xs:text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  wrapperClassName="w-full"
                />
              </div>             
              <div>
                <label className="text-sm xs:text-xs font-medium text-gray-700 mb-2 flex items-center space-x-1">
                  <Calendar className="h-4 w-4 xs:h-3 xs:w-3" />
                  <span>Ημερομηνία Λήξης *</span>
                </label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  minDate={startDate}
                  locale="el"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Επιλέξτε ημερομηνία"
                  className="w-full px-3 py-2 xs:px-2 xs:py-1.5 text-sm xs:text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  wrapperClassName="w-full"
                />
              </div>
              {/* Display calculated days */}
              {startDate && endDate && days > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Συνολικές Ημέρες:</span>
                    <span className="font-bold text-blue-600">{days} {days === 1 ? 'ημέρα' : 'ημέρες'}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-xs text-gray-600">
                      {formatDate(startDate)} - {formatDate(endDate)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm xs:text-xs font-medium text-gray-700 mb-2">
                Αιτιολογία *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="π.χ. Κλείσιμο εταιρείας, Εθνική αργία, Έκτακτη συντήρηση κτιρίου"
                rows="4"
                className="w-full px-3 py-2 xs:px-2 xs:py-1.5 text-sm xs:text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">* Υποχρεωτικό πεδίο</p>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm xs:text-xs mb-2">
                <span className="text-gray-600">Επιλεγμένοι:</span>
                <span className="font-bold text-blue-600">{selectedUsers.length} υπάλληλοι</span>
              </div>
              <div className="flex justify-between text-sm xs:text-xs mb-4">
                <span className="text-gray-600">Σύνολο ημερών:</span>
                <span className="font-bold text-orange-600">
                  {selectedUsers.length * days}
                </span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={selectedUsers.length === 0 || !startDate || !endDate || days <= 0 || !reason.trim()}
              className="w-full px-4 py-2 xs:px-3 xs:py-1.5 text-sm xs:text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              <Check className="h-4 w-4 xs:h-3 xs:w-3" />
              <span>Καταχώρηση Άδειας</span>
            </button>
          </div>
        </div>
      </div>
      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-800">Προειδοποίηση Υπέρβασης</h3>
            </div>           
            <p className="text-sm text-gray-600 mb-4">
              Οι παρακάτω υπάλληλοι δεν έχουν αρκετές διαθέσιμες ημέρες (υπόλοιπο 2025):
            </p>
            <div className="space-y-3 mb-6">
              {usersExceedingLimit.map((user, index) => (
                <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="font-medium text-gray-800 text-sm">{user.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Διαθέσιμες: {user.remaining} ημέρες
                  </p>
                  <p className="text-xs text-orange-700 font-semibold mt-1">
                    Υπέρβαση: {user.exceeding} ημέρες
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Είστε σίγουροι ότι θέλετε να συνεχίσετε; Αυτό θα δημιουργήσει αρνητικό υπόλοιπο.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setUsersExceedingLimit([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Ακύρωση
              </button>
              <button
                onClick={proceedWithGrant}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Συνέχεια Ούτως ή Άλλως
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageDaysView;