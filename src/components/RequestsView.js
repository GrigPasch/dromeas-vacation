import React from 'react';
import { Clock, Check, X, Shield } from 'lucide-react';
import { calculateDaysBetween, LEAVE_TYPES } from '../utils/vacationUtils';

const RequestsView = ({ currentUser, vacationRequests, userDatabase, departments, holidays = [] }) => {
  const userRequests = vacationRequests
    .filter(req => (req.user_id || req.userId) === currentUser.id)
    .sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt);
      const dateB = new Date(b.created_at || b.createdAt);
      return dateB - dateA;
    });

  const getManagerName = (managerId) => {
    if (!managerId) return 'Άγνωστος';
    return userDatabase.find(u => u.id === managerId)?.name || 'Άγνωστος';
  };

  const getStatusInfo = (request) => {
    // Manager-granted mandatory leave — show purple with granter's name
    if (request.manager_granted || request.managerGranted) {
      const granterName = getManagerName(request.reviewed_by || request.reviewedBy);
      return {
        icon: <Shield className="h-4 w-4" />,
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        label: `Χορηγήθηκε από ${granterName}`,
        description: `Η άδεια χορηγήθηκε από τον/την ${granterName}`
      };
    }

    const status = request.status;
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="h-4 w-4" />,
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          label: 'Αναμονή Έγκρισης - Διαχειριστής 1',
          description: 'Η αίτησή σας αναμένει την έγκριση του Διαχειριστή Επιπέδου 1'
        };
      case 'manager1_approved':
        return {
          icon: <Shield className="h-4 w-4" />,
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          label: 'Εγκρίθηκε από προιστάμενο - Αναμονή CEO',
          description: 'Η αίτησή σας εγκρίθηκε από τον προιστάμενο τμήματος και αναμένει τον CEO'
        };
      case 'approved':
        return {
          icon: <Check className="h-4 w-4" />,
          color: 'bg-green-100 text-green-800 border-green-200',
          label: 'Εγκρίθηκε',
          description: 'Η αίτησή σας εγκρίθηκε οριστικά'
        };
      default:
        return {
          icon: <X className="h-4 w-4" />,
          color: 'bg-red-100 text-red-800 border-red-200',
          label: 'Απορρίφθηκε',
          description: 'Η αίτησή σας απορρίφθηκε'
        };
    }
  };

  const getLeaveTypeInfo = (leaveType) => LEAVE_TYPES[leaveType] || LEAVE_TYPES.vacation;

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Οι Αιτήσεις μου</h2>
      </div>

      {userRequests.map(request => {
        const statusInfo = getStatusInfo(request);
        const leaveTypeInfo = getLeaveTypeInfo(request.leave_type || request.leaveType);
        const startDate = new Date(request.start_date || request.startDate);
        const endDate = new Date(request.end_date || request.endDate);
        const workingDays = calculateDaysBetween(request.start_date || request.startDate, request.end_date || request.endDate, holidays);

        const isGranted = request.manager_granted || request.managerGranted;
        return (
          <div key={request.id} className={`border-2 rounded-lg p-4 ${isGranted ? 'bg-purple-50 border-purple-200' : 'bg-white ' + statusInfo.color.split(' ')[2]}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{leaveTypeInfo.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-800">{leaveTypeInfo.label}</h3>
                  <p className="text-xs text-gray-600">{workingDays} εργάσιμες ημέρες</p>
                </div>
              </div>
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full border ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="text-xs font-medium">{statusInfo.label}</span>
              </div>
            </div>
            {/* ΣΥΜΠΥΚΝΩΜΕΝΗ ΠΡΟΒΟΛΗ ΗΜΕΡΩΝ */}
            <div className="mb-3 p-3 bg-white/60 rounded border border-gray-100 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Περίοδος Άδειας</p>
              <p className="text-sm text-gray-700">
                <span className="font-bold text-gray-900">
                  {startDate.toLocaleDateString('el-GR', { weekday: 'long' })} {startDate.toLocaleDateString('el-GR')}
                </span>
                <span className="mx-2 text-gray-400 font-normal">έως και</span>
                <span className="font-bold text-gray-900">
                  {endDate.toLocaleDateString('el-GR', { weekday: 'long' })} {endDate.toLocaleDateString('el-GR')}
                </span>
              </p>
            </div>

            {request.reason && (
              <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded mb-3 border border-gray-100">
                "{request.reason}"
              </p>
            )}
            {/* Timeline — hidden for manager-granted leaves */}
            {!isGranted && (
              <div className="mt-3 pt-3 border-t border-gray-200/50 space-y-1">
                <div className="flex items-center text-[11px] text-gray-500">
                  <div className={`w-2 h-2 rounded-full mr-2 ${request.manager1_status === 'manager1_approved' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  Δ1: {request.manager1_id ? getManagerName(request.manager1_id) : 'Εκκρεμεί'}
                </div>
                {request.manager1_status === 'manager1_approved' && (
                  <div className="flex items-center text-[11px] text-gray-500">
                    <div className={`w-2 h-2 rounded-full mr-2 ${request.status === 'approved' ? 'bg-green-500' : 'bg-blue-500'}`} />
                    Δ2: {request.manager2_id ? getManagerName(request.manager2_id) : 'Αναμονή'}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RequestsView;