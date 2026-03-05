/* eslint-disable default-case */
import React, { useState, useMemo } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import el from 'date-fns/locale/el';
import 'react-datepicker/dist/react-datepicker.css';
import { X, Check, Info } from 'lucide-react';
import { calculateDaysBetween, getLeaveYear, getUsedDaysByLeaveYear } from '../utils/vacationUtils';

registerLocale('el', el);

const LEAVE_TYPES = [
  { value: 'vacation', label: 'Κανονική Άδεια', icon: '🏖️' },
  { value: 'unjustified', label: 'Α.Α. - Αδικαιολόγητη Απουσία', icon: '⚠️' },
  { value: 'maternity', label: 'Μητρότητα', icon: '🤱', gender: 'female' },
  { value: 'paternity', label: 'Πατρότητα', icon: '👶', gender: 'male' },
  { value: 'unpaid', label: 'Άνευ Αποδοχών', icon: '💼' }
];

const RequestModal = ({ 
  onSubmit, 
  onClose, 
  currentUser, 
  existingRequests = [], 
  holidays = [], 
  annualBalances = [] 
}) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState('vacation');

  const selectedLeaveYear = useMemo(() => {
    return getLeaveYear(startDate || new Date());
  }, [startDate]);

  const isManager = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || "").toLowerCase();
    const level = Number(currentUser.manager_level || currentUser.managerLevel || 0);
    return role === 'manager' || role === 'admin' || level > 0;
  }, [currentUser]);

  const isDateSelectable = (date) => {
    if (isManager) return true;
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkDate >= today;
  };

  const availableLeaveTypes = LEAVE_TYPES.filter(type => {
    if (!type.gender) return true;
    if (!currentUser?.gender) return true;
    return type.gender === currentUser.gender;
  });

  const checkDateOverlap = (newStartDate, newEndDate) => {
    if (!existingRequests || !Array.isArray(existingRequests) || !currentUser) {
      return { hasOverlap: false };
    }

    const userRequests = existingRequests.filter(req => {
      const reqUserId = req.user_id || req.userId;
      return reqUserId === currentUser.id && (req.status === 'approved' || req.status === 'pending' || req.status === 'manager1_approved');
    });

    const newStart = new Date(newStartDate);
    const newEnd = new Date(newEndDate);

    for (let request of userRequests) {
      const startDateField = request.startDate || request.start_date;
      const endDateField = request.endDate || request.end_date;
      
      if (!startDateField || !endDateField) continue;
      
      const existingStart = new Date(startDateField);
      const existingEnd = new Date(endDateField);
      
      if (
        (newStart >= existingStart && newStart <= existingEnd) ||
        (newEnd >= existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      ) {
        return {
          hasOverlap: true,
          conflictingRequest: request
        };
      }
    }
    return { hasOverlap: false };
  };

  const calculateRemainingDays = (type) => {
    if (!currentUser) return 0;
    
    switch (type) {
      case 'vacation': 
        let totalAllowed = 0;

        if (annualBalances && annualBalances.length > 0) {
          const pivotedEntry = annualBalances.find(b => Number(b.userId || b.user_id) === Number(currentUser.id));
          const yearKey = `balance_${selectedLeaveYear}`;
          
          if (pivotedEntry && pivotedEntry[yearKey] !== undefined) {
            totalAllowed = Number(pivotedEntry[yearKey]);
          } else {
            const rawEntry = annualBalances.find(b => Number(b.cycle_start_year || b.year) === selectedLeaveYear);
            if (rawEntry && rawEntry.total_allowed !== undefined) {
              totalAllowed = Number(rawEntry.total_allowed);
            }
          }
        }
        
        const usedInCycle = getUsedDaysByLeaveYear(currentUser.id, existingRequests, selectedLeaveYear, holidays);
        return Math.max(0, totalAllowed - usedInCycle);
        
      case 'unjustified': return '∞';
      case 'maternity': return currentUser.maternity_days_total || currentUser.maternityDaysTotal || 119;
      case 'paternity': return currentUser.paternity_days_total || currentUser.paternityDaysTotal || 14;
      default: return 0;
    }
  };

  const handleSubmit = () => {
    if (!startDate || !endDate || !reason || !leaveType) {
      alert('Παρακαλώ συμπληρώστε όλα τα πεδία');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0,0,0,0);

    if (!isManager && start < today) {
      alert('Η ημερομηνία έναρξης δεν μπορεί να είναι στο παρελθόν.');
      return;
    }

    if (end < start) {
      alert('Η ημερομηνία λήξης δεν μπορεί να είναι πριν την έναρξη.');
      return;
    }

    const overlapCheck = checkDateOverlap(start, end);
    if (overlapCheck.hasOverlap) {
      const conflictRequest = overlapCheck.conflictingRequest;
      const conflictStartDate = conflictRequest.startDate || conflictRequest.start_date;
      const conflictEndDate = conflictRequest.endDate || conflictRequest.end_date;
      const conflictStart = new Date(conflictStartDate).toLocaleDateString('el-GR');
      const conflictEnd = new Date(conflictEndDate).toLocaleDateString('el-GR');
      
      alert(`Οι ημερομηνίες επικαλύπτονται με υπάρχουσα αίτηση (${conflictStart} - ${conflictEnd}).`);
      return;
    }

    const totalDaysRequested = calculateDaysBetween(start, end, holidays);
    const availableDays = calculateRemainingDays(leaveType);

    if (leaveType === 'vacation' && typeof availableDays === 'number' && totalDaysRequested > availableDays) {
      alert(`Δεν έχετε αρκετές ημέρες υπολοίπου για το έτος άδειας ${selectedLeaveYear}. (Διαθέσιμες: ${availableDays})`);
      return;
    }

    onSubmit({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      reason,
      leaveType,
      leaveYear: selectedLeaveYear
    });

    onClose();
  };

  const getDisabledDates = () => {
    const disabledDates = [];
    if (!existingRequests || !Array.isArray(existingRequests) || !currentUser) return disabledDates;

    const userRequests = existingRequests.filter(req => {
      const reqUserId = req.user_id || req.userId;
      return reqUserId === currentUser.id && (req.status === 'approved' || req.status === 'pending' || req.status === 'manager1_approved');
    });

    userRequests.forEach(request => {
      const start = new Date(request.startDate || request.start_date);
      const end = new Date(request.endDate || request.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        disabledDates.push(new Date(d));
      }
    });
    return disabledDates;
  };

  const disabledDatesList = getDisabledDates();

  if (!currentUser) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Ζητήστε Άδεια</h3>
            {startDate && (
              <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">
                Υπολογισμός βάσει έτους: {selectedLeaveYear}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          {/* Leave Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Τύπος Άδειας</label>
            <div className="grid grid-cols-2 gap-2">
              {availableLeaveTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setLeaveType(type.value)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    leaveType === type.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-xs font-bold">{type.label}</div>
                </button>
              ))}
            </div>
          </div>
          {/* Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Από</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                filterDate={isDateSelectable}
                excludeDates={disabledDatesList}
                locale="el"
                dateFormat="dd/MM/yyyy"
                placeholderText="Επιλέξτε ημερομηνία"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Έως</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate || new Date()}
                excludeDates={disabledDatesList}
                locale="el"
                dateFormat="dd/MM/yyyy"
                placeholderText="Επιλέξτε ημερομηνία"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Αιτιολογία</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Γράψτε μια αιτιολογία..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20 resize-none"
            />
          </div>
          {/* Balance Display */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Info className="h-3 w-3 text-blue-500" />
              <span className="text-[11px] text-blue-700 font-bold uppercase">
                Υπόλοιπο έτους {selectedLeaveYear}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600 font-medium">Διαθέσιμες ημέρες:</span>
              <span className="font-bold text-blue-700">{calculateRemainingDays(leaveType)} ημέρες</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Ακύρωση
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 font-bold"
          >
            <Check className="h-4 w-4" />
            <span>Υποβολή Αίτησης</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestModal;