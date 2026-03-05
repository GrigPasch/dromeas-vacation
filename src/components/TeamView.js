import React, { useState } from 'react';
import { Shield, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { getUsedDays, getUsedDaysByType, getUsedDaysByLeaveYear, LEAVE_TYPES, calculateDaysBetween } from '../utils/vacationUtils';
import DepartmentFilter from './DepartmentFilter';

const TeamView = ({ userDatabase, vacationRequests, departments, holidays = [], annualBalances = [] }) => {
  const [selectedDepartments, setSelectedDepartments] = useState(
    departments.map(dept => dept.id)
  );

  const [sortBy, setSortBy] = useState('name');
  const [expandedUsers, setExpandedUsers] = useState([]);

  const getAnnualAllowance = (userId) => {
    if (!annualBalances || annualBalances.length === 0) return 0;
      const pivoted = annualBalances.find(b => Number(b.userId || b.user_id) === Number(userId));
      if (pivoted && pivoted.balance_2025 !== undefined) return Number(pivoted.balance_2025);
        const raw = annualBalances.find(b => Number(b.user_id || b.userId) === Number(userId) && Number(b.cycle_start_year || b.year) === 2025);
          if (raw && raw.total_allowed !== undefined) return Number(raw.total_allowed);
    return 0;
  };

  const getGrantedDays = (userId) => {
    if (!vacationRequests) return 0;
    
    return vacationRequests.filter(req => {
      const reqUserId = req.user_id || req.userId;
      const isManagerGranted = req.manager_granted || req.managerGranted || false;
      return reqUserId === userId && req.status === 'approved' && isManagerGranted;
    })
    .reduce((total, req) => {
      const startDateField = req.start_date || req.startDate;
      const endDateField = req.end_date || req.endDate;
        
      if (!startDateField || !endDateField) return total;
        
      const workingDays = calculateDaysBetween(startDateField, endDateField, holidays);
      return total + workingDays;
    }, 0);
  };

  const filteredUsers = userDatabase.filter(user => {
    const departmentId = user.department_id || user.departmentId;
    return selectedDepartments.includes(departmentId);
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '', 'el-GR');
      case 'department':
        const deptA = departments.find(d => d.id === (a.department_id || a.departmentId));
        const deptB = departments.find(d => d.id === (b.department_id || b.departmentId));
        return (deptA?.name || '').localeCompare(deptB?.name || '', 'el-GR');
      case 'remaining_days':
        const totalDaysA = getAnnualAllowance(a.id);
        const totalDaysB = getAnnualAllowance(b.id);
        const leaveYear2025 = 2025;
        const usedA = Math.max(0, (a.total_days || a.totalDays || 0) - getAnnualAllowance(a.id)) + getUsedDaysByLeaveYear(a.id, vacationRequests, leaveYear2025, holidays);
        const usedB = Math.max(0, (b.total_days || b.totalDays || 0) - getAnnualAllowance(b.id)) + getUsedDaysByLeaveYear(b.id, vacationRequests, leaveYear2025, holidays);
        const grantedA = getGrantedDays(a.id);
        const grantedB = getGrantedDays(b.id);
        const remainingA = totalDaysA - usedA - grantedA;
        const remainingB = totalDaysB - usedB - grantedB;
        return remainingB - remainingA;
      case 'used_days':
        const totalUsedA = getUsedDays(a.id, vacationRequests, null, holidays);
        const totalUsedB = getUsedDays(b.id, vacationRequests, null, holidays);
        return totalUsedB - totalUsedA;
      default:
        return 0;
    }
  });

  const getDepartmentById = (departmentId) => {
    return departments.find(dept => dept.id === departmentId);
  };

  const toggleUserExpand = (userId) => {
    setExpandedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const usersByDepartment = selectedDepartments.map(deptId => {
    const department = getDepartmentById(deptId);
    const deptUsers = sortedUsers.filter(user => {
      const userDeptId = user.department_id || user.departmentId;
      return userDeptId === deptId;
    });
    return {
      department,
      users: deptUsers
    };
  }).filter(group => group.users.length > 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 xs:mb-4 gap-4">
        <h2 className="text-xl xs:text-lg font-semibold text-gray-800">Επισκόπηση Αδειών Ομάδας</h2>       
        <div className="flex flex-col xs:flex-col sm:flex-row items-stretch sm:items-center gap-3 xs:gap-2 w-full sm:w-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 xs:px-2 xs:py-1.5 text-sm xs:text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="name">Κατά όνομα</option>
            <option value="department">Κατά Τμήμα</option>
            <option value="remaining_days">Κατά Υπολειπόμενες</option>
            <option value="used_days">Κατά Χρησιμοποιημένες</option>
          </select>
          <DepartmentFilter
            departments={departments}
            selectedDepartments={selectedDepartments}
            onDepartmentChange={setSelectedDepartments}
            className="w-full sm:min-w-[200px]"
          />
        </div>
      </div>
      <div className="mb-6 xs:mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 xs:gap-2">
        <div className="bg-white p-4 xs:p-3 rounded-lg border">
          <h4 className="font-medium text-gray-700 text-sm xs:text-xs">Υπάλληλοι</h4>
          <p className="text-2xl xs:text-xl font-bold text-blue-600">{sortedUsers.length}</p>
        </div>
        <div className="bg-white p-4 xs:p-3 rounded-lg border">
          <h4 className="font-medium text-gray-700 text-sm xs:text-xs">Μ.Ο. Αδειών</h4>
          <p className="text-2xl xs:text-xl font-bold text-green-600">
            {sortedUsers.length > 0 
              ? Math.round(sortedUsers.reduce((sum, user) => {
                  const totalDays = user.totalDays || user.total_days || 0;
                  return sum + totalDays;
                }, 0) / sortedUsers.length)
              : 0
            }
          </p>
        </div>
        <div className="bg-white p-4 xs:p-3 rounded-lg border">
          <h4 className="font-medium text-gray-700 text-sm xs:text-xs">Εγκρίσεις</h4>
          <p className="text-2xl xs:text-xl font-bold text-orange-600">
            {sortedUsers.reduce((sum, user) => sum + getUsedDays(user.id, vacationRequests, null, holidays), 0)}
          </p>
        </div>
        <div className="bg-white p-4 xs:p-3 rounded-lg border">
          <h4 className="font-medium text-gray-700 text-sm xs:text-xs">Τμήματα</h4>
          <p className="text-2xl xs:text-xl font-bold text-purple-600">{usersByDepartment.length}</p>
        </div>
      </div>

      {usersByDepartment.map(({ department, users }) => (
        <div key={department.id} className="mb-8 xs:mb-6">
          <div className="flex items-center space-x-3 xs:space-x-2 mb-4 xs:mb-3">
            <div
              className="w-4 h-4 xs:w-3 xs:h-3 rounded-full"
              style={{ backgroundColor: department.color }}
            ></div>
            <h3 className="text-lg xs:text-base font-semibold text-gray-800">{department.name}</h3>
            <span className="text-sm xs:text-xs text-gray-500">({users.length} υπάλληλοι)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-3">
            {users.map(user => {
              const userRequestDays = getUsedDaysByLeaveYear(user.id, vacationRequests, 2025, holidays);
              const userTotalDays = user.totalDays || user.total_days || 0;
              const userAnnualAllowance = getAnnualAllowance(user.id);
              const userImplicitUsed = Math.max(0, userTotalDays - userAnnualAllowance);
              const userGrantedDays = getGrantedDays(user.id);
              const userUsedDays = userImplicitUsed + userRequestDays + userGrantedDays;
              const userRemainingDays = Math.max(0, userTotalDays - userUsedDays);
              const usagePercentage = userTotalDays > 0 ? (userUsedDays / userTotalDays) * 100 : 0;
              const isExpanded = expandedUsers.includes(user.id);
              const usedByType = getUsedDaysByType(user.id, vacationRequests, holidays);
              
              return (
                <div key={user.id} className="border border-gray-200 rounded-lg p-4 xs:p-3 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3 xs:space-x-2 mb-3 xs:mb-2">
                    <div 
                      className="h-10 w-10 xs:h-8 xs:w-8 rounded-full flex items-center justify-center text-white font-semibold text-sm xs:text-xs flex-shrink-0"
                      style={{ backgroundColor: department.color }}
                    >
                      {(user.name || '').split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-800 xs:text-sm truncate">{user.name}</h4>
                        {user.role === 'manager' && <Shield className="h-3 w-3 xs:h-2.5 xs:w-2.5 text-blue-600 flex-shrink-0" />}
                      </div>
                      <p className="text-xs xs:text-[10px] text-gray-600 truncate">{user.email}</p>
                    </div>
                  </div>                 
                  <div className="space-y-2 xs:space-y-1.5">
                    <div className="flex justify-between text-sm xs:text-xs">
                      <span className="font-medium text-gray-600">Σύνολο:</span>
                      <span className="font-bold text-red-600">{userTotalDays}</span>
                    </div>
                    <div className="flex justify-between text-sm xs:text-xs">
                      <span className="font-medium text-gray-600">Εγκρίθηκαν:</span>
                      <span className="font-bold text-blue-600">{userUsedDays}</span>
                    </div>
                    {userGrantedDays > 0 && (
                      <div className="flex justify-between text-sm xs:text-xs">
                        <span className="font-medium text-gray-600">Χορηγήθηκαν:</span>
                        <span className="font-bold text-purple-600">{userGrantedDays}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm xs:text-xs">
                      <span className="font-medium text-gray-600">Απομένουν:</span>
                      <span className={`font-bold ${userRemainingDays <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {userRemainingDays}
                      </span>
                    </div>                    
                    <div className="w-full bg-gray-200 rounded-full h-2 xs:h-1.5">
                      <div 
                        className="h-2 xs:h-1.5 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(usagePercentage, 100)}%`,
                          backgroundColor: usagePercentage > 80 ? '#EF4444' : 
                                            usagePercentage > 60 ? '#F59E0B' : 
                                            department.color
                        }}
                      ></div>
                    </div>
                    <div className="text-xs xs:text-[10px] text-gray-500 text-center">
                      {Math.round(usagePercentage)}% χρησιμοποιημένο
                    </div>
                  </div>
                  <button
                    onClick={() => toggleUserExpand(user.id)}
                    className="w-full mt-3 xs:mt-2 flex items-center justify-center space-x-1 text-xs xs:text-[10px] text-blue-600 hover:text-blue-700 py-1"
                  >
                    <span>{isExpanded ? 'Απόκρυψη' : 'Εμφάνιση'} λεπτομερειών</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3 xs:h-2.5 xs:w-2.5" /> : <ChevronDown className="h-3 w-3 xs:h-2.5 xs:w-2.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 xs:mt-2 pt-3 xs:pt-2 border-t space-y-2 xs:space-y-1.5">
                      {Object.entries(LEAVE_TYPES).map(([type, info]) => {
                        const used = usedByType[type] || 0;
                        if (used === 0 && type !== 'mandatory') return null;
                        if (type === 'mandatory' && userGrantedDays > 0) {
                          return (
                            <div 
                              key={type}
                              className="flex items-center justify-between text-xs xs:text-[10px] p-2 xs:p-1.5 rounded"
                              style={{ backgroundColor: `${info.color}10` }}
                            >
                              <div className="flex items-center space-x-1">
                                <span className="text-sm xs:text-xs">{info.icon}</span>
                                <span className="text-gray-600">{info.label}:</span>
                              </div>
                              <span 
                                className="font-bold"
                                style={{ color: info.color }}
                              >
                                {userGrantedDays} ημέρες
                              </span>
                            </div>
                          );
                        }
                        
                        if (type === 'mandatory') return null;
                        
                        return (
                          <div 
                            key={type}
                            className="flex items-center justify-between text-xs xs:text-[10px] p-2 xs:p-1.5 rounded"
                            style={{ backgroundColor: `${info.color}10` }}
                          >
                            <div className="flex items-center space-x-1">
                              <span className="text-sm xs:text-xs">{info.icon}</span>
                              <span className="text-gray-600">{info.label}:</span>
                            </div>
                            <span 
                              className="font-bold"
                              style={{ color: info.color }}
                            >
                              {used} ημέρες
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {userRemainingDays <= 5 && userRemainingDays > 0 && (
                    <div className="mt-2 p-2 xs:p-1.5 bg-yellow-50 border border-yellow-200 rounded text-xs xs:text-[10px] text-yellow-700">
                      ⚠️ Λίγες διαθέσιμες ημέρες
                    </div>
                  )}
                  
                  {userRemainingDays <= 0 && (
                    <div className="mt-2 p-2 xs:p-1.5 bg-red-50 border border-red-200 rounded text-xs xs:text-[10px] text-red-700">
                      🚫 Δεν υπάρχουν διαθέσιμες ημέρες
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {sortedUsers.length === 0 && (
        <div className="text-center py-12 xs:py-8 text-gray-500">
          <Users className="h-16 w-16 xs:h-12 xs:w-12 mx-auto mb-4 xs:mb-3 opacity-50" />
          <h3 className="text-lg xs:text-base font-medium mb-2">Δεν βρέθηκαν υπάλληλοι</h3>
          <p className="xs:text-sm">Δεν υπάρχουν υπάλληλοι στα επιλεγμένα τμήματα.</p>
        </div>
      )}
    </div>
  );
};

export default TeamView;