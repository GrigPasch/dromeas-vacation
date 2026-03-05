import React from 'react';
import { Check, X, Calendar } from 'lucide-react';
import { isGreekHoliday } from '../utils/vacationUtils';

const ApprovalsView = ({ 
  currentUser, 
  pendingRequests, 
  userDatabase, 
  onRequestDecision 
  }) => {
    const managerLevel = currentUser.managerLevel || currentUser.manager_level || 1;
    const relevantRequests = pendingRequests.filter(req => {
      const requestUser = userDatabase.find(u => u.id === (req.user_id || req.userId));
      
      if (!requestUser) return false;
    
      if (managerLevel === 1) {
        return req.status === 'pending' && requestUser.manager_id === currentUser.id;
      }
      else if (managerLevel === 2) {
        return req.status === 'manager1_approved';
      }

      return false;
    });

    const getDayBreakdown = (start, end) => {
      let workdays = 0;
      let weekends = 0;
      let holidayCount = 0;
      let foundHolidays = [];

      let current = new Date(start);
      const last = new Date(end);

      while (current <= last) {
        const dayOfWeek = current.getDay();
        const holidayName = isGreekHoliday(current);

        if (holidayName) {
          holidayCount++;
          foundHolidays.push(holidayName);
        }
        else if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekends++;
        } 
        else {
          workdays++;
        }
        current.setDate(current.getDate() + 1);
        }

      return { workdays, weekends, holidayCount, foundHolidays: [...new Set(foundHolidays)] };
    };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 xs:text-sm">Εγκρίσεις Αδειών - Επίπεδο {managerLevel}</h2>
        </div>
        <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md">
          {relevantRequests.length} εκκρεμείς
        </div>
      </div>
      {relevantRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <Check className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Όλες οι αιτήσεις έχουν αξιολογηθεί.</p>
        </div>
      ) : (
        relevantRequests.map(request => {
          const user = userDatabase.find(u => u.id === (request.user_id || request.userId));
          const startDate = new Date(request.start_date || request.startDate);
          const endDate = new Date(request.end_date || request.endDate);
          const breakdown = getDayBreakdown(startDate, endDate);

          return (
            <div key={request.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              {/* User Info Section */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shadow-inner">
                  {user?.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-none">{user?.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">Αίτημα για {breakdown.workdays} ημέρες</p>
                </div>
              </div>
              {/* DATE RANGE DISPLAY */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Περίοδος</p>
                <p className="text-sm font-semibold text-gray-800">
                  {startDate.toLocaleDateString('el-GR', { weekday: 'long' })} {startDate.toLocaleDateString('el-GR')}
                  <span className="mx-2 text-gray-400 font-normal">έως</span>
                  {endDate.toLocaleDateString('el-GR', { weekday: 'long' })} {endDate.toLocaleDateString('el-GR')}
                </p>
              </div>
              {/* DYNAMIC BREAKDOWN BOX */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center space-x-2 text-[10px] font-bold text-blue-500 uppercase mb-2">
                  <Calendar className="h-3 w-3" />
                  <span>Ανάλυση Ημερών</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-blue-900">
                  <span className="font-bold">{breakdown.workdays} Εργάσιμες</span>
                  
                  {breakdown.weekends > 0 && (
                    <>
                      <span className="text-blue-300">|</span>
                      <span>{breakdown.weekends} Σαββατοκύριακα</span>
                    </>
                  )}
                  {breakdown.holidayCount > 0 && (
                    <>
                      <span className="text-blue-300">|</span>
                      <span className="flex items-center text-orange-600 font-medium">
                        {breakdown.holidayCount} Αργία: {breakdown.foundHolidays.join(', ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {request.reason && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 italic">
                  "{request.reason}"
                </div>
              )}
              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => onRequestDecision(request.id, 'approved', managerLevel)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg flex items-center justify-center space-x-2 font-medium transition-all active:scale-95"
                >
                  <Check className="h-4 w-4" /> <span>Έγκριση</span>
                </button>
                <button
                  onClick={() => onRequestDecision(request.id, 'rejected', managerLevel)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg flex items-center justify-center space-x-2 font-medium transition-all active:scale-95"
                >
                  <X className="h-4 w-4" /> <span>Απόρριψη</span>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ApprovalsView;