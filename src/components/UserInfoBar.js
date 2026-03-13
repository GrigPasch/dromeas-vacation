import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getUsedDaysByType, getUsedDaysByLeaveYear, getLeaveYear, LEAVE_TYPES } from '../utils/vacationUtils';

const UserInfoBar = ({ 
  currentUser, 
  usedDays: propUsedDays,
  remainingDays,
  department, 
  vacationRequests,
  annualBalances = [],
  holidays = []
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const displayTotalDays = currentUser.total_days || currentUser.totalDays || 0;

  const usedByType = useMemo(() => {
    return getUsedDaysByType(currentUser.id, vacationRequests, holidays);
  }, [currentUser.id, vacationRequests, holidays]);

  const getAllowanceForYear = (year) => {
    if (!annualBalances || !Array.isArray(annualBalances) || annualBalances.length === 0) return 0;
    const pivoted = annualBalances.find(b => Number(b.userId || b.user_id) === Number(currentUser.id));
    if (pivoted) {
      const key = 'balance_' + year;
      if (pivoted[key] !== undefined) return Number(pivoted[key]);
    }
    const raw = annualBalances.find(b =>
      Number(b.userId || b.user_id) === Number(currentUser.id) &&
      Number(b.cycle_start_year || b.year) === year
    );
    return raw?.total_allowed !== undefined ? Number(raw.total_allowed) : 0;
  };

  const currentLeaveYear = getLeaveYear(new Date());
  const nextLeaveYear = currentLeaveYear + 1;

  const annualBalance2025 = useMemo(() => getAllowanceForYear(currentLeaveYear), [currentUser.id, annualBalances, currentLeaveYear]);
  const annualBalance2026 = useMemo(() => getAllowanceForYear(nextLeaveYear), [currentUser.id, annualBalances, nextLeaveYear]);

  const displayUsedDays = useMemo(() => {
    const requestDays = getUsedDaysByLeaveYear(currentUser.id, vacationRequests, currentLeaveYear, holidays);
    const implicitUsed = Math.max(0, displayTotalDays - annualBalance2025);
    return implicitUsed + requestDays;
  }, [currentUser.id, vacationRequests, currentLeaveYear, holidays, displayTotalDays, annualBalance2025]);

  // How many of the used days came from the next cycle
  const overflowIntoNextYear = Math.max(0, displayUsedDays - annualBalance2025);
  const usedFromCurrentYear = Math.min(displayUsedDays, annualBalance2025);

  const displayRemainingDays = Math.max(0, displayTotalDays - displayUsedDays);

  const grantedDays = useMemo(() => {
    if (!vacationRequests) return 0;
    return vacationRequests
      .filter(req => {
        const reqUserId = req.user_id || req.userId;
        const isManagerGranted = req.manager_granted || req.managerGranted;
        return reqUserId === currentUser.id && req.status === 'approved' && isManagerGranted;
      })
      .reduce((total, req) => {
        const startDateField = req.start_date || req.startDate;
        const endDateField = req.end_date || req.endDate;
        if (!startDateField || !endDateField) return total;
        const start = new Date(startDateField);
        const end = new Date(endDateField);
        const days = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
        return total + days;
      }, 0);
  }, [currentUser.id, vacationRequests]);

  const remainingByType = {
    vacation: Math.max(0, displayTotalDays - displayUsedDays), 
    unjustified: Infinity,
    maternity: Math.max(0, (currentUser.maternity_days_total || currentUser.maternityDaysTotal || 119) - (usedByType.maternity || 0)),
    paternity: Math.max(0, (currentUser.paternity_days_total || currentUser.paternityDaysTotal || 14) - (usedByType.paternity || 0)),
    unpaid: Infinity,
    mandatory: 0
  };

  const availableBeforeGrant = displayRemainingDays;
  const grantedWithinLimit = Math.max(0, Math.min(grantedDays, availableBeforeGrant));
  const grantedExcess = Math.max(0, grantedDays - availableBeforeGrant);

  // Tooltip for used days when overflow exists
  const UsedDaysTooltip = () => {
    if (overflowIntoNextYear <= 0) {
      return <p className="text-xl xs:text-lg font-bold text-blue-600">{displayUsedDays}</p>;
    }
    return (
      <div className="relative group inline-block cursor-help">
        <p className="text-xl xs:text-lg font-bold text-orange-500 underline decoration-dotted">
          {displayUsedDays}
        </p>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-left shadow-xl">
          <p className="font-bold text-yellow-300 mb-1">Υπέρβαση ορίου κύκλου</p>
          <p>
            <span className="text-yellow-300 font-bold">{usedFromCurrentYear} ημέρες</span>
            {' '}από τον κύκλο{' '}
            <span className="text-yellow-300 font-bold">{currentLeaveYear}</span>
            {' '}(σύνολο {annualBalance2025})
          </p>
          <p className="mt-1">
            <span className="text-red-400 font-bold">{overflowIntoNextYear} ημέρες</span>
            {' '}από τον κύκλο{' '}
            <span className="text-yellow-300 font-bold">{nextLeaveYear}</span>
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="mb-6">
      <div className="p-4 bg-white rounded-lg border shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div
              className="h-12 w-12 xs:h-10 xs:w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm xs:text-xs flex-shrink-0"
              style={{ backgroundColor: department?.color || '#3B82F6' }}
            >
              {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'U'}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 xs:text-sm">{currentUser.name}</h3>
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                <p className="text-sm xs:text-xs text-gray-600">{department?.name || 'No Department'}</p>
                {department && (
                  <>
                    <span className="text-sm xs:text-xs text-gray-400">•</span>
                    <div className="flex items-center space-x-1">
                      <div
                        className="w-2 h-2 xs:w-1.5 xs:h-1.5 rounded-full"
                        style={{ backgroundColor: department.color }}
                      ></div>
                      <span className="text-sm xs:text-xs text-gray-500">{department.name}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-initial">
              <div className="grid grid-cols-3 gap-3 xs:gap-2">
                <div className="text-center">
                  <p className="text-xs xs:text-[10px] text-gray-600 font-medium">Διαθέσιμες</p>
                  <p className={'text-xl xs:text-lg font-bold ' + (displayRemainingDays <= 5 ? 'text-red-600' : 'text-green-600')}>
                    {displayRemainingDays}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs xs:text-[10px] text-gray-600 font-medium">Χρησιμ.</p>
                  <UsedDaysTooltip />
                </div>
                <div className="text-center">
                  <p className="text-xs xs:text-[10px] text-gray-600 font-medium">Σύνολο</p>
                  <p className="text-xl xs:text-lg font-bold text-gray-800">{displayTotalDays}</p>
                </div>
              </div>
              {grantedDays > 0 && (
                <div className="mt-2 text-center">
                  <p className="text-xs xs:text-[10px] text-purple-600 font-medium">+ {grantedDays} Χορηγημένες</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              {showDetails ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </button>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-2 p-4 xs:p-3 bg-white rounded-lg border animate-in fade-in slide-in-from-top-2">
          <h4 className="font-semibold text-gray-800 mb-3">Ανάλυση Αδειών ανά Τύπο</h4>

          {/* Overflow warning in details */}
          {overflowIntoNextYear > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
              <p className="font-semibold text-orange-800 mb-1">⚠️ Υπέρβαση {currentLeaveYear}</p>
              <p className="text-orange-700">
                Χρησιμοποιήθηκαν{' '}
                <span className="font-bold text-orange-900">{usedFromCurrentYear}</span> από τις {' '}
                <span className="font-bold">{annualBalance2025}</span> ημέρες του {currentLeaveYear} και{' '}
                <span className="font-bold text-red-600">{overflowIntoNextYear} επιπλέον ημέρες</span>{' '}
                από το {nextLeaveYear}.
              </p>
            </div>
          )}

          {grantedDays > 0 && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <h5 className="font-semibold text-purple-800 mb-2 text-sm">🏢 Χορηγημένες Υποχρεωτικές Άδειες</h5>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Σύνολο χορηγημένων:</span>
                  <span className="font-bold text-purple-600">{grantedDays} ημέρες</span>
                </div>
                {grantedExcess > 0 ? (
                  <div className="space-y-1">
                    {grantedWithinLimit > 0 && (
                      <div className="flex items-center space-x-2">
                        <div 
                          className="h-6 bg-green-500 rounded flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ width: Math.max(15, (grantedWithinLimit / grantedDays) * 100) + '%' }}
                        >{grantedWithinLimit}</div>
                        <span className="text-[10px] text-gray-600">από διαθέσιμες</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <div 
                        className="h-6 bg-red-500 rounded flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ width: Math.max(15, (grantedExcess / grantedDays) * 100) + '%' }}
                      >{grantedExcess}</div>
                      <span className="text-[10px] text-gray-600">υπέρβαση ορίου</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-8 bg-green-100 border border-green-200 rounded flex items-center justify-center text-green-700 text-xs font-semibold">
                      ✓ Όλες εντός διαθέσιμων ({grantedDays} ημέρες)
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 xs:gap-2">
            {Object.entries(LEAVE_TYPES)
              .filter(([type]) => {
                if (type === 'maternity' && currentUser.gender === 'male') return false;
                if (type === 'paternity' && currentUser.gender === 'female') return false;
                if (type === 'mandatory' && grantedDays === 0) return false;
                return true;
              })
              .map(([type, info]) => {
                const baseUsed = type === 'mandatory' ? grantedDays : (usedByType[type] || 0);
                const totalForType = type === 'vacation' 
                  ? displayTotalDays
                  : type === 'maternity' ? (currentUser.maternity_days_total || currentUser.maternityDaysTotal || 119)
                  : type === 'paternity' ? (currentUser.paternity_days_total || currentUser.paternityDaysTotal || 14)
                  : type === 'mandatory' ? grantedDays : 0;

                const used = type === 'vacation' ? displayUsedDays : baseUsed;
                const remaining = type === 'mandatory' ? 0 : remainingByType[type];
                const total = (totalForType !== 0 && totalForType !== undefined) ? totalForType : '∞';
                const percentage = total !== '∞' && total > 0 ? (used / total) * 100 : 0;
                const hasNoLimit = type === 'unjustified' || type === 'unpaid';
                const isOverflow = type === 'vacation' && overflowIntoNextYear > 0;

                return (
                  <div key={type} className={'p-3 xs:p-2 rounded-lg border hover:shadow-md transition-shadow ' + (isOverflow ? 'bg-orange-50/40 border-orange-200' : 'bg-gray-50/30')}>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xl">{info.icon}</span>
                      <h5 className="text-xs font-bold text-gray-700 truncate">{info.label}</h5>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Σύνολο:</span>
                        <span className="font-bold">{hasNoLimit ? '∞' : total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Χρησιμ.:</span>
                        {isOverflow ? (
                          <div className="relative group inline-block cursor-help">
                            <span className="font-bold text-orange-500 underline decoration-dotted">{used}</span>
                            <div className="absolute right-0 bottom-full mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                              <p><span className="text-yellow-300 font-bold">{usedFromCurrentYear}</span> από <span className="text-yellow-300 font-bold">{currentLeaveYear}</span></p>
                              <p className="mt-0.5"><span className="text-red-400 font-bold">{overflowIntoNextYear}</span> από <span className="text-yellow-300 font-bold">{nextLeaveYear}</span></p>
                              <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        ) : (
                          <span className="font-bold text-blue-600">{used}</span>
                        )}
                      </div>
                      {!hasNoLimit && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Απομένουν:</span>
                          <span className={'font-bold ' + (remaining === Infinity ? 'text-green-600' : remaining <= 0 ? 'text-red-600' : remaining <= 5 ? 'text-orange-500' : 'text-green-600')}>
                            {remaining === Infinity ? '∞' : Math.max(0, remaining)}
                          </span>
                        </div>
                      )}
                    </div>
                    {!hasNoLimit && type !== 'mandatory' && total > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="h-1.5 rounded-full transition-all duration-500" 
                            style={{ 
                              width: Math.min(percentage, 100) + '%', 
                              backgroundColor: info.color || '#3B82F6' 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserInfoBar;