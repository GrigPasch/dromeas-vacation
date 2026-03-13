import React, { useState, useMemo } from 'react';
import { History, AlertCircle, CheckCircle, Calendar, X, Search } from 'lucide-react';
import { getUsedDays, isGreekHoliday } from '../utils/vacationUtils';
import DepartmentFilter from './DepartmentFilter';
import DatePicker, { registerLocale } from 'react-datepicker';
import el from 'date-fns/locale/el';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('el', el);

const GrantedDaysHistoryView = ({ currentUser, userDatabase, vacationRequests, departments }) => {
  const [selectedDepartments, setSelectedDepartments] = useState(
    departments.map(dept => dept.id)
  );
  const [startDateFilter, setStartDateFilter] = useState(null);
  const [endDateFilter, setEndDateFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getDayBreakdown = (start, end) => {
    let workdays = 0;
    let calendarDays = 0;
    let allDaysFormatted = [];
    let foundHolidays = [];

    let current = new Date(start);
    const last = new Date(end);
    const dayFormatter = new Intl.DateTimeFormat('el-GR', { weekday: 'short' });

    while (current <= last) {
      calendarDays++;
      const dayName = dayFormatter.format(current);
      const dayOfWeek = current.getDay();
      const holidayName = isGreekHoliday(current);

      if (holidayName) {
        foundHolidays.push(holidayName);
        allDaysFormatted.push({ name: dayName, isWorkday: false });
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        allDaysFormatted.push({ name: dayName, isWorkday: false });
      } else {
        workdays++;
        allDaysFormatted.push({ name: dayName, isWorkday: true });
      }
      current.setDate(current.getDate() + 1);
    }

    return { 
      workdays, 
      calendarDays, 
      allDaysFormatted,
      foundHolidays: [...new Set(foundHolidays)] 
    };
  };

  const allGrantedLeaves = useMemo(() => {
    if (!vacationRequests || !Array.isArray(vacationRequests)) return [];
    
    return vacationRequests
      .filter(req => req.manager_granted || req.managerGranted || false)
      .map(req => {
        const userId = req.user_id || req.userId;
        const user = userDatabase.find(u => u.id === userId);
        const grantedBy = userDatabase.find(u => u.id === (req.reviewed_by || req.reviewedBy));
        const start = new Date(req.start_date || req.startDate);
        const end = new Date(req.end_date || req.endDate);
        const breakdown = getDayBreakdown(start, end);
        const userUsedDays = getUsedDays(userId, vacationRequests, 'vacation');
        const userTotalDays = user?.totalDays || user?.total_days || 0;
        const userRemainingDays = Math.max(0, userTotalDays - userUsedDays);
        
        return {
          id: req.id,
          user,
          deptId: user?.department_id || user?.departmentId,
          grantedBy,
          daysGranted: breakdown.workdays,
          breakdown,
          reason: req.reason,
          grantedDate: new Date(req.reviewed_date || req.reviewedDate || req.created_at),
          startDate: start,
          endDate: end,
          exceededLimit: breakdown.workdays > userRemainingDays,
          excessDays: Math.max(0, breakdown.workdays - userRemainingDays)
        };
      })
      .sort((a, b) => b.grantedDate - a.grantedDate);
  }, [vacationRequests, userDatabase]);

  const filteredLeaves = useMemo(() => {
    return allGrantedLeaves.filter(grant => {
      const matchesDept = selectedDepartments.includes(grant.deptId);
      const matchesSearch = !searchTerm || (grant.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (startDateFilter && endDateFilter) {
        matchesDate = grant.grantedDate >= startDateFilter && grant.grantedDate <= endDateFilter;
      } else if (startDateFilter) {
        matchesDate = grant.grantedDate >= startDateFilter;
      } else if (endDateFilter) {
        matchesDate = grant.grantedDate <= endDateFilter;
      }
      return matchesDept && matchesSearch && matchesDate;
    });
  }, [allGrantedLeaves, selectedDepartments, startDateFilter, endDateFilter, searchTerm]);

  const stats = useMemo(() => ({
    totalGrants: filteredLeaves.length,
    totalDaysGranted: filteredLeaves.reduce((sum, g) => sum + g.daysGranted, 0),
    grantsExceedingLimit: filteredLeaves.filter(g => g.exceededLimit).length,
    totalExcessDays: filteredLeaves.reduce((sum, g) => sum + g.excessDays, 0)
  }), [filteredLeaves]);

  if (currentUser.role !== 'manager') return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 xs:text-sm">Ιστορικό Χορηγήσεων Άδειας</h2>
          <p className="text-xs text-gray-500 mt-1">Διαχείριση και έλεγχος αδειών</p>
        </div>
        <History className="h-6 w-6 text-blue-600" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Συνολικές Χορηγήσεις</p>
          <p className="text-xl font-bold text-blue-600">{stats.totalGrants}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Ημέρες Χορήγησης</p>
          <p className="text-xl font-bold text-purple-600">{stats.totalDaysGranted}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Υπερβάσεις</p>
          <p className="text-xl font-bold text-orange-600">{stats.grantsExceedingLimit}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Ημέρες Υπέρβασης</p>
          <p className="text-xl font-bold text-red-600">{stats.totalExcessDays}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start gap-4">

          {/* Name Search */}
          <div className="w-full md:w-56">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Αναζήτηση Υπαλλήλου</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Όνομα υπαλλήλου..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              />
            </div>
          </div>

          {/* Department Filter — overflow visible so dropdown isn't clipped */}
          <div className="w-full md:w-72" style={{ position: 'relative', zIndex: 50 }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Φίλτρο Τμήματος</p>
            <DepartmentFilter
              departments={departments}
              selectedDepartments={selectedDepartments}
              onDepartmentChange={setSelectedDepartments}
              className="w-full"
            />
          </div>

          {/* Date Range */}
          <div className="w-full md:w-auto">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Εύρος Ημερομηνίας Χορήγησης</p>
            <div className="flex items-center gap-2">
              <DatePicker
                selected={startDateFilter}
                onChange={date => setStartDateFilter(date)}
                placeholderText="Από"
                className="text-sm border border-gray-300 rounded-lg p-2 w-32 outline-none focus:ring-2 focus:ring-blue-500"
                locale="el"
                dateFormat="dd/MM/yyyy"
                popperPlacement="bottom-start"
              />
              <span className="text-gray-400">—</span>
              <DatePicker
                selected={endDateFilter}
                onChange={date => setEndDateFilter(date)}
                placeholderText="Έως"
                className="text-sm border border-gray-300 rounded-lg p-2 w-32 outline-none focus:ring-2 focus:ring-blue-500"
                locale="el"
                dateFormat="dd/MM/yyyy"
                popperPlacement="bottom-start"
              />
              {(startDateFilter || endDateFilter) && (
                <button 
                  onClick={() => { setStartDateFilter(null); setEndDateFilter(null); }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredLeaves.map(grant => {
          const dept = departments.find(d => d.id === grant.deptId);
          return (
            <div key={grant.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-blue-200 transition-colors">
              <div className="flex flex-wrap justify-between gap-4">
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: dept?.color || '#3B82F6' }}>
                      {grant.user?.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{grant.user?.name}</h4>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">{dept?.name}</p>
                    </div>
                  </div>

                  <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-400 uppercase mb-2">
                      <Calendar className="h-3 w-3" />
                      <span>Λεπτομέρειες Περιόδου</span>
                    </div>
                    <div className="mb-3 pb-2 border-b border-gray-200">
                      <p className="text-sm font-bold text-gray-800">
                        {grant.startDate.toLocaleDateString('el-GR')} — {grant.endDate.toLocaleDateString('el-GR')}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] text-gray-500 font-bold uppercase block mb-1 xs:text-[10px]">
                          {'Ημερολογιακές (' + grant.breakdown.calendarDays + ' μέρες):'}
                        </span>
                        <div className="flex flex-wrap gap-1 xs:text-[10px]">
                          {grant.breakdown.allDaysFormatted.map((day, idx) => (
                            <span key={idx} className="text-sm font-medium">
                              <span className={day.isWorkday ? "text-gray-800" : "text-[#da0f0f] font-semibold"}>
                                {day.name}
                              </span>
                              {idx < grant.breakdown.allDaysFormatted.length - 1 && (
                                <span className="mx-1 text-gray-300 xs:text-[10px]">|</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <span className="text-[11px] text-blue-600 font-bold uppercase block mb-1">
                          {grant.daysGranted === 1 
                            ? 'Εργάσιμη : ' + grant.daysGranted + ' μέρα:'
                            : 'Εργάσιμες : ' + grant.daysGranted + ' μέρες:'}
                        </span>
                        <div className="text-sm font-bold text-blue-700 italic">
                          {grant.breakdown.allDaysFormatted
                            .filter(d => d.isWorkday)
                            .map(d => d.name)
                            .join(' - ')}
                        </div>
                      </div>
                      {grant.breakdown.foundHolidays.length > 0 && (
                        <div className="text-[10px] text-orange-600 font-bold uppercase bg-orange-50 px-2 py-0.5 rounded inline-block">
                          {'Αργία: ' + grant.breakdown.foundHolidays.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-3 italic">"{grant.reason}"</p>
                </div>
                <div className="flex flex-col items-end justify-between py-1 xs:flex xs:flex-row xs:gap-6">
                  <div className="text-right xs:text-left">
                    <span className="text-2xl font-black text-purple-600 leading-none">{grant.daysGranted}</span>
                    <span className="text-[10px] font-bold text-purple-300 block uppercase">Ημέρες</span>
                  </div>
                  {grant.exceededLimit ? (
                    <div className="bg-orange-50 text-orange-700 p-2 rounded-lg border border-orange-100 flex items-center space-x-1 xs:text-right">
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase">{'Υπέρβαση +' + grant.excessDays}</span>
                    </div>
                  ) : (
                    <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100 flex items-center space-x-1 xs:text-right">
                      <CheckCircle className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase">Εντός Ορίου</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredLeaves.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Δεν βρέθηκαν χορηγήσεις για τα επιλεγμένα φίλτρα.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrantedDaysHistoryView;