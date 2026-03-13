import React, { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import DepartmentFilter from './DepartmentFilter';
import { getUsedDaysByLeaveYear, calculateDaysBetween } from '../utils/vacationUtils';

const YEARS = [2024, 2025, 2026];

const getCurrentCycleYear = () => {
  const now = new Date();
  return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
};

const YearlyBalanceView = ({ annualBalances = [], departments = [], userDatabase = [], vacationRequests = [], holidays = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedYears, setSelectedYears] = useState([getCurrentCycleYear()]);

  const toggleYear = (year) => {
    setSelectedYears(prev =>
      prev.includes(year)
        ? prev.length === 1 ? prev : prev.filter(y => y !== year)
        : [...prev, year].sort()
    );
  };

  useEffect(() => {
    if (departments.length > 0 && selectedDepartments.length === 0) {
      setSelectedDepartments(departments.map(d => d.id));
    }
  }, [departments]);

  const getAllowance = (userId, year) => {
    const pivoted = annualBalances.find(b => Number(b.userId || b.user_id) === Number(userId));
    if (pivoted) {
      const key = 'balance_' + year;
      if (pivoted[key] !== undefined) return Number(pivoted[key]);
    }
    const raw = annualBalances.find(b =>
      Number(b.user_id || b.userId) === Number(userId) &&
      Number(b.cycle_start_year || b.year) === year
    );
    return raw?.total_allowed !== undefined ? Number(raw.total_allowed) : 0;
  };

  const getApproved = (userId, year) => {
    return getUsedDaysByLeaveYear(userId, vacationRequests, year, holidays);
  };

  const getGranted = (userId, year) => {
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
      .reduce((total, req) => total + calculateDaysBetween(req.start_date || req.startDate, req.end_date || req.endDate, holidays), 0);
  };

  // How many days did the previous cycle go into overdraft (i.e. borrowed from this year)
  const getOverflow = (userId, year) => {
    const prevYear = year - 1;
    const prevAllowed = getAllowance(userId, prevYear);
    if (prevAllowed === 0) return 0;
    const prevApproved = getApproved(userId, prevYear);
    const prevGranted = getGranted(userId, prevYear);
    const prevRemaining = prevAllowed - prevApproved - prevGranted;
    return prevRemaining < 0 ? Math.abs(prevRemaining) : 0;
  };

  const filteredData = useMemo(() => {
    return annualBalances.filter(item => {
      const name = item?.name || '';
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
      const userId = item?.userId || item?.user_id;
      const userInDb = userDatabase?.find(u => u.id === userId);
      const deptId = item?.departmentId || item?.department_id || userInDb?.department_id || userInDb?.departmentId;
      const matchesDept = selectedDepartments.length === 0 || selectedDepartments.includes(Number(deptId));
      return matchesSearch && matchesDept;
    });
  }, [annualBalances, searchTerm, selectedDepartments, userDatabase]);

  const colorForRemaining = (remaining, allowed) => {
    if (allowed === 0) return 'text-gray-400';
    if (remaining <= 0) return 'text-red-600 font-bold';
    if (remaining <= 5) return 'text-orange-500 font-bold';
    return 'text-green-600 font-bold';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Αναζήτηση υπαλλήλου..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-auto">
          <DepartmentFilter
            departments={departments}
            selectedDepartments={selectedDepartments}
            onDepartmentChange={setSelectedDepartments}
          />
        </div>
      </div>

      {/* Year Filter */}
      <div className="flex items-center gap-3 mb-2">
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
        <span className="text-xs text-gray-400 ml-2">(1 Απριλίου – 31 Μαρτίου)</span>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase" rowSpan="2">Υπάλληλος</th>
              {selectedYears.map(year => (
                <th key={year} colSpan="4" className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase border-l border-gray-200">
                  {'1 Απριλίου ' + year + ' – 31 Μαρτίου ' + (year + 1)}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50 border-t border-gray-200">
              {selectedYears.map(year => (
                <React.Fragment key={year}>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase border-l border-gray-200">Σύνολο</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-blue-400 uppercase">Εγκρίθηκαν</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-purple-400 uppercase">Χορηγήθηκαν</th>
                  <th className="px-2 py-2 text-center text-[10px] font-semibold text-green-500 uppercase">Απομένουν</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.length > 0 ? filteredData.map(row => {
              const userId = row.userId || row.user_id;
              return (
                <tr key={userId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 border-r text-sm whitespace-nowrap">{row.name}</td>
                  {(() => {
                    const cells = [];
                    let overflowTooltip = null;

                    for (let i = 0; i < selectedYears.length; i++) {
                      const year = selectedYears[i];
                      const allowed = getAllowance(userId, year);
                      const approved = getApproved(userId, year);
                      const granted = getGranted(userId, year);
                      // Subtract any days borrowed from this cycle by the previous one
                      const overflow = getOverflow(userId, year);
                      const remaining = allowed - approved - granted - overflow;

                      // Tooltip: if THIS year's own usage overdraws it (ignoring prev overflow)
                      const ownRemaining = allowed - approved - granted;
                      if (ownRemaining < 0 && allowed > 0) {
                        const nextYear = year + 1;
                        const overdrawn = Math.abs(ownRemaining);
                        overflowTooltip = (
                          <span>
                            Ο {row.name} χρησιμοποίησε όλες τις ημέρες του{' '}
                            <span className="text-yellow-300 font-bold">{year}</span>{' '}
                            (<span className="text-yellow-300 font-bold">{allowed} ημέρες</span>) και επιπλέον{' '}
                            <span className="text-red-400 font-bold">{overdrawn} ημέρες</span>{' '}
                            από το{' '}
                            <span className="text-yellow-300 font-bold">{nextYear}</span>.
                          </span>
                        );
                      }

                      // Also show tooltip if this year has overflow coming in from prev year
                      if (overflow > 0 && !overflowTooltip) {
                        const prevYear = year - 1;
                        overflowTooltip = (
                          <span>
                            Ο {row.name} χρησιμοποίησε {' '}
                            <span className="text-red-400 font-bold">{overflow} ημέρες</span>{' '}
                            από το {' '}
                            <span className="text-yellow-300 font-bold">{year}</span>{' '}
                          </span>
                        );
                      }

                      cells.push(
                        <React.Fragment key={year}>
                          <td className="px-2 py-3 text-center text-sm font-semibold text-gray-600 border-l border-gray-100">{allowed || '—'}</td>
                          <td className="px-2 py-3 text-center text-sm font-semibold text-blue-600">{approved > 0 ? approved : '—'}</td>
                          <td className="px-2 py-3 text-center text-sm font-semibold text-purple-600">{granted > 0 ? granted : '—'}</td>
                          <td className={'px-2 py-3 text-center text-sm ' + colorForRemaining(remaining, allowed)}>
                            {allowed > 0 ? remaining : '—'}
                          </td>
                        </React.Fragment>
                      );
                    }

                    return (
                      <>
                        {cells}
                        {overflowTooltip && (
                          <td className="px-2 py-3 text-center">
                            <div className="relative group inline-block">
                              <span className="text-orange-500 cursor-help text-base">⚠️</span>
                              <div className="absolute right-0 bottom-full mb-2 w-72 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-left shadow-xl">
                                {overflowTooltip}
                                <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </td>
                        )}
                      </>
                    );
                  })()}
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={1 + selectedYears.length * 4} className="px-6 py-10 text-center text-gray-400">
                  {annualBalances.length === 0 ? 'Δεν υπάρχουν δεδομένα στη βάση.' : 'Δεν βρέθηκαν αποτελέσματα.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default YearlyBalanceView;