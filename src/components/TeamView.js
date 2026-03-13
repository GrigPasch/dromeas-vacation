import React, { useState } from 'react';
import { Shield, Users, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { getUsedDaysByLeaveYear, calculateDaysBetween, LEAVE_TYPES, getUsedDaysByTypeForYears } from '../utils/vacationUtils';
import DepartmentFilter from './DepartmentFilter';

const YEARS = [2024, 2025, 2026];

const TeamView = ({ userDatabase, vacationRequests, departments, holidays = [], annualBalances = [] }) => {
  const [selectedDepartments, setSelectedDepartments] = useState(departments.map(d => d.id));
  const [selectedYears, setSelectedYears] = useState([2025]);
  const [sortBy, setSortBy] = useState('name');
  const [expandedUsers, setExpandedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleYear = (year) => {
    setSelectedYears(prev =>
      prev.includes(year)
        ? prev.length === 1 ? prev : prev.filter(y => y !== year)
        : [...prev, year].sort()
    );
  };

  const getAllowanceForYear = (userId, year) => {
    if (!annualBalances || annualBalances.length === 0) return 0;
    const pivoted = annualBalances.find(b => Number(b.userId || b.user_id) === Number(userId));
    if (pivoted) {
      const key = 'balance_' + year;
      if (pivoted[key] !== undefined) return Number(pivoted[key]);
    }
    const raw = annualBalances.find(b =>
      Number(b.user_id || b.userId) === Number(userId) &&
      Number(b.cycle_start_year || b.year) === year
    );
    if (raw && raw.total_allowed !== undefined) return Number(raw.total_allowed);
    return 0;
  };

  const getApprovedDaysForYear = (userId, year) => {
    return getUsedDaysByLeaveYear(userId, vacationRequests, year, holidays);
  };

  const getGrantedDaysForYear = (userId, year) => {
    if (!vacationRequests) return 0;
    return vacationRequests
      .filter(req => {
        const reqUserId = req.user_id || req.userId;
        const isGranted = req.manager_granted || req.managerGranted;
        if (!isGranted || reqUserId !== userId || req.status !== 'approved') return false;
        const startDate = req.start_date || req.startDate;
        if (!startDate) return false;
        const d = new Date(startDate);
        const cycleYear = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
        return cycleYear === year;
      })
      .reduce((total, req) => {
        return total + calculateDaysBetween(req.start_date || req.startDate, req.end_date || req.endDate, holidays);
      }, 0);
  };

  const getUserYearData = (userId, year) => {
    const allowed = getAllowanceForYear(userId, year);
    const approved = getApprovedDaysForYear(userId, year);
    const granted = getGrantedDaysForYear(userId, year);
    const remaining = Math.max(0, allowed - approved - granted);
    return { allowed, approved, granted, remaining };
  };

  const filteredUsers = userDatabase.filter(user => {
    const departmentId = user.department_id || user.departmentId;
    const inDept = selectedDepartments.includes(departmentId);
    const matchesSearch = !searchTerm || (user.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return inDept && matchesSearch;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'el-GR');
    if (sortBy === 'department') {
      const dA = departments.find(d => d.id === (a.department_id || a.departmentId));
      const dB = departments.find(d => d.id === (b.department_id || b.departmentId));
      return (dA?.name || '').localeCompare(dB?.name || '', 'el-GR');
    }
    if (sortBy === 'remaining_days') {
      const primaryYear = selectedYears[selectedYears.length - 1];
      return getUserYearData(b.id, primaryYear).remaining - getUserYearData(a.id, primaryYear).remaining;
    }
    return 0;
  });

  const usersByDepartment = selectedDepartments.map(deptId => ({
    department: departments.find(d => d.id === deptId),
    users: sortedUsers.filter(u => (u.department_id || u.departmentId) === deptId)
  })).filter(g => g.department && g.users.length > 0);

  const toggleUserExpand = (userId) => {
    setExpandedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Επισκόπηση Αδειών Ομάδας</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Κατά όνομα</option>
            <option value="department">Κατά Τμήμα</option>
            <option value="remaining_days">Κατά Υπολειπόμενες</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Αναζήτηση υπαλλήλου..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-52"
            />
          </div>
          <DepartmentFilter
            departments={departments}
            selectedDepartments={selectedDepartments}
            onDepartmentChange={setSelectedDepartments}
            className="w-full sm:min-w-[200px]"
          />
        </div>
      </div>

      {/* Year Filter */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Χρονολογία:</span>
          {YEARS.map(year => (
            <button
              key={year}
              onClick={() => toggleYear(year)}
              className={'px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ' +
                (selectedYears.includes(year)
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 text-gray-500 hover:border-blue-400')}
            >
              {year}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">(1 Απριλίου – 31 Μαρτίου)</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-700 text-sm">Υπάλληλοι</h4>
          <p className="text-2xl font-bold text-blue-600">{sortedUsers.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-700 text-sm">Τμήματα</h4>
          <p className="text-2xl font-bold text-purple-600">{usersByDepartment.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-700 text-sm">{'Σύνολο Εγκρίσεων (' + selectedYears.join(', ') + ')'}</h4>
          <p className="text-2xl font-bold text-orange-600">
            {sortedUsers.reduce((sum, u) =>
              sum + selectedYears.reduce((s, y) => s + getApprovedDaysForYear(u.id, y), 0), 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-700 text-sm">{'Σύνολο Χορηγήσεων (' + selectedYears.join(', ') + ')'}</h4>
          <p className="text-2xl font-bold text-green-600">
            {sortedUsers.reduce((sum, u) =>
              sum + selectedYears.reduce((s, y) => s + getGrantedDaysForYear(u.id, y), 0), 0)}
          </p>
        </div>
      </div>

      {/* Users by Department */}
      {usersByDepartment.map(({ department, users }) => (
        <div key={department.id} className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: department.color }} />
            <h3 className="font-semibold text-gray-700">{department.name}</h3>
            <span className="text-xs text-gray-400">({users.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {users.map(user => {
              const isExpanded = expandedUsers.includes(user.id);

              return (
                <div key={user.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3 mb-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                      style={{ backgroundColor: department.color }}
                    >
                      {(user.name || '').split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-800 text-sm truncate">{user.name}</h4>
                        {user.role === 'manager' && <Shield className="h-3 w-3 text-blue-600 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Year Blocks */}
                  <div className="space-y-3">
                    {selectedYears.map(year => {
                      const { allowed, approved, granted, remaining } = getUserYearData(user.id, year);
                      const used = approved + granted;
                      const pct = allowed > 0 ? Math.min((used / allowed) * 100, 100) : 0;
                      return (
                        <div key={year} className="bg-gray-50 rounded-lg p-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-black">{'1 Απριλίου ' + year + ' – 31 Μαρτίου ' + (year + 1)}</span>
                            <span className={'text-xs font-bold px-2 py-0.5 rounded-full ' +
                              (remaining === 0 ? 'bg-red-100 text-red-700' :
                               remaining <= 5 ? 'bg-yellow-100 text-yellow-700' :
                               'bg-green-100 text-green-700')}>
                              {remaining} απομένουν
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-center mb-2">
                            <div>
                              <p className="text-[10px] text-black uppercase">Σύνολο</p>
                              <p className="text-sm font-bold text-gray-700">{allowed}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-black uppercase">Εγκρίθηκαν</p>
                              <p className="text-sm font-bold text-blue-600">{approved}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-black uppercase">Χορηγήθηκαν</p>
                              <p className="text-sm font-bold text-purple-600">{granted}</p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all duration-300"
                              style={{
                                width: pct + '%',
                                backgroundColor: pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : department.color
                              }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 text-center mt-1">{Math.round(pct)}% χρησιμοποιημένο</p>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => toggleUserExpand(user.id)}
                    className="w-full mt-3 flex items-center justify-center space-x-1 text-xs text-blue-600 hover:text-blue-700 py-1"
                  >
                    <span>{isExpanded ? 'Απόκρυψη' : 'Εμφάνιση'} ανά τύπο άδειας</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      {selectedYears.map(year => {
                        const yearUsedByType = getUsedDaysByTypeForYears(user.id, vacationRequests, [year], holidays);
                        const grantedThisYear = getGrantedDaysForYear(user.id, year);
                        const hasAnyData = Object.entries(yearUsedByType).some(([t, v]) => v > 0) || grantedThisYear > 0;
                        return (
                          <div key={year}>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                              {'1 Απριλίου ' + year + ' – 31 Μαρτίου ' + (year + 1)}
                            </p>
                            {!hasAnyData && (
                              <p className="text-[10px] text-gray-400 italic px-2">Καμία άδεια</p>
                            )}
                            <div className="space-y-1">
                              {Object.entries(LEAVE_TYPES).map(([type, info]) => {
                                const used = type === 'mandatory' ? grantedThisYear : (yearUsedByType[type] || 0);
                                if (used === 0) return null;
                                return (
                                  <div key={type} className="flex items-center justify-between text-xs p-2 rounded" style={{ backgroundColor: info.color + '10' }}>
                                    <div className="flex items-center space-x-1">
                                      <span>{info.icon}</span>
                                      <span className="text-gray-600">{info.label}:</span>
                                    </div>
                                    <span className="font-bold" style={{ color: info.color }}>{used} ημέρες</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {sortedUsers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Δεν βρέθηκαν υπάλληλοι</h3>
          <p>Δεν υπάρχουν υπάλληλοι στα επιλεγμένα τμήματα.</p>
        </div>
      )}
    </div>
  );
};

export default TeamView;