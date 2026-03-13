export const LEAVE_TYPES = {
  vacation: { label: 'Κανονική Άδεια', icon: '🏖️', color: '#3B82F6' },
  unjustified: { label: 'Αδικαιολόγητη Απουσία', icon: '⚠️', color: '#B91C1C' },
  maternity: { label: 'Μητρότητα', icon: '🤱', color: '#EC4899' },
  paternity: { label: 'Πατρότητα', icon: '👶', color: '#8B5CF6' },
  unpaid: { label: 'Άνευ Αποδοχών', icon: '💼', color: '#6B7280' },
  mandatory: { label: 'Υποχρεωτική Άδεια', icon: '🏢', color: '#9333EA' }
};

export const getLeaveYear = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11 (Jan is 0, Mar is 2, Apr is 3)
  return month < 3 ? year - 1 : year;
};

/**
 * Βρίσκει το εγκεκριμένο υπόλοιπο (total_allowed) από τον πίνακα annualBalances 
 * για συγκεκριμένο χρήστη και έτος κύκλου.
 */
export const getYearlyBalance = (userId, annualBalances, leaveYear) => {
  if (!annualBalances || !Array.isArray(annualBalances)) return 0;
  const balance = annualBalances.find(b => 
    Number(b.user_id || b.userId) === Number(userId) && 
    Number(b.cycle_start_year || b.year) === Number(leaveYear)
  );
  return balance ? Number(balance.total_allowed) : 0;
};

export const calculateDaysBetween = (startDate, endDate, holidays = []) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) return 0; // Guard for invalid dates

  let count = 0;
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    
    // Check if it's a weekend (0 = Sunday, 6 = Saturday)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Check if it's a holiday
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const isHoliday = holidays && holidays.some(h => {
      const holidayDate = new Date(h.holiday_date);
      const holidayStr = `${holidayDate.getFullYear()}-${String(holidayDate.getMonth() + 1).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`;
      return holidayStr === dateStr;
    });
    
    // Only count if it's not a weekend and not a holiday
    if (!isWeekend && !isHoliday) {
      count++;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return count;
};

/**
 * Υπολογίζει τις χρησιμοποιημένες ημέρες ενός χρήστη για ένα συγκεκριμένο ΕΤΟΣ ΑΔΕΙΑΣ (Απρ-Μαρ)
 */
export const getUsedDaysByLeaveYear = (userId, requests, leaveYear, holidays) => {
  if (!requests) return 0;
  return requests
    .filter(req => {
      const reqUserId = Number(req.user_id || req.userId);
      const reqLeaveYear = getLeaveYear(req.start_date || req.startDate);
      const status = req.status;
      
      const isActive = status === 'approved' || status === 'pending' || status === 'manager1_approved';
      const type = (req.leave_type || req.leaveType || req.type || '').toLowerCase();
      
      return reqUserId === Number(userId) && 
      isActive && 
      reqLeaveYear === Number(leaveYear) &&
      (type === 'vacation' || type === 'mandatory');
    })
    .reduce((total, req) => {
      return total + calculateDaysBetween(req.start_date || req.startDate, req.end_date || req.endDate, holidays);
    }, 0);
};

export const getUsedDays = (userId, vacationRequests, leaveType = null, holidays = []) => {
  if (!vacationRequests || !Array.isArray(vacationRequests)) {
    return 0;
  }

  return vacationRequests
    .filter(req => {
      const reqUserId = Number(req.user_id || req.userId);
      const reqLeaveType = (req.leave_type || req.leaveType || req.type || 'vacation').toLowerCase();
      const isManagerGranted = req.manager_granted || req.managerGranted || false;
    
      if (isManagerGranted && leaveType !== 'mandatory') {
      }
      
      const matchesUser = reqUserId === Number(userId) && (req.status === 'approved' || req.status === 'pending' || req.status === 'manager1_approved');
      
      if (leaveType) {
        return matchesUser && reqLeaveType === leaveType.toLowerCase();
      }
      return matchesUser;
    })
    .reduce((total, req) => {
      const startDate = req.start_date || req.startDate;
      const endDate = req.end_date || req.endDate;
      
      if (!startDate || !endDate) return total;

      if (req.total_days || req.totalDays) return total + Number(req.total_days || req.totalDays);
      
      return total + calculateDaysBetween(startDate, endDate, holidays);
    }, 0);
};

export const getUsedDaysByType = (userId, vacationRequests, holidays = []) => {
  return {
    vacation: getUsedDays(userId, vacationRequests, 'vacation', holidays),
    unjustified: getUsedDays(userId, vacationRequests, 'unjustified', holidays),
    maternity: getUsedDays(userId, vacationRequests, 'maternity', holidays),
    paternity: getUsedDays(userId, vacationRequests, 'paternity', holidays),
    unpaid: getUsedDays(userId, vacationRequests, 'unpaid', holidays),
    mandatory: getUsedDays(userId, vacationRequests, 'mandatory', holidays),
  };
};

/**
 * Υπολογίζει το υπόλοιπο βασισμένο στο annualBalances (total_allowed) του τρέχοντος έτους κύκλου
 */
export const getRemainingDaysByType = (user, vacationRequests, annualBalances = [], holidays = []) => {
  const currentLeaveYear = getLeaveYear(new Date());
  const nextLeaveYear = currentLeaveYear + 1;
  const userId = Number(user.id || user.userId);
  const usedDaysInYear = getUsedDaysByLeaveYear(userId, vacationRequests, currentLeaveYear, holidays);
  const yearlyAllowed = getYearlyBalance(userId, annualBalances, currentLeaveYear);
  const currentRemaining = yearlyAllowed - usedDaysInYear;

  let vacationRemaining;
  if (currentRemaining <= 0) {
    const nextYearAllowed = getYearlyBalance(userId, annualBalances, nextLeaveYear);
    const usedDaysInNextYear = getUsedDaysByLeaveYear(userId, vacationRequests, nextLeaveYear, holidays);
    vacationRemaining = nextYearAllowed - usedDaysInNextYear;
  } else {
    vacationRemaining = currentRemaining;
  }

  const usedByType = getUsedDaysByType(userId, vacationRequests, holidays);

  return {
    vacation: vacationRemaining,
    unjustified: Infinity,
    maternity: (user.maternityDaysTotal || user.maternity_days_total || 119) - (usedByType.maternity || 0),
    paternity: (user.paternityDaysTotal || user.paternity_days_total || 14) - (usedByType.paternity || 0),
    unpaid: Infinity,
    mandatory: 0
  };
};

export const getSubordinates = (managerId, userDatabase) => {
  if (!userDatabase || !Array.isArray(userDatabase)) return [];
  return userDatabase.filter(user => Number(user.managerId || user.manager_id) === Number(managerId));
};

export const getPendingRequestsForApproval = (managerId, vacationRequests, userDatabase) => {
  if (!vacationRequests || !userDatabase) return [];
  const subordinateIds = getSubordinates(managerId, userDatabase).map(sub => Number(sub.id));
  return vacationRequests.filter(req => {
    const reqUserId = Number(req.user_id || req.userId);
    return subordinateIds.includes(reqUserId) && req.status === 'pending';
  });
};

export const hasEnoughVacationDays = (userId, startDate, endDate, leaveType, userDatabase, vacationRequests, annualBalances = [], holidays = []) => {
  const user = userDatabase.find(u => Number(u.id) === Number(userId));
  if (!user) return false;
  
  const requestedDays = calculateDaysBetween(startDate, endDate, holidays);
  const leaveYear = getLeaveYear(startDate);

  if (leaveType === 'vacation') {
    const yearlyAllowed = getYearlyBalance(userId, annualBalances, leaveYear);
    const usedInYear = getUsedDaysByLeaveYear(userId, vacationRequests, leaveYear, holidays);
    const currentRemaining = yearlyAllowed - usedInYear;

    if (currentRemaining >= requestedDays) return true;

    const nextLeaveYear = leaveYear + 1;
    const nextYearAllowed = getYearlyBalance(userId, annualBalances, nextLeaveYear);
    const usedInNextYear = getUsedDaysByLeaveYear(userId, vacationRequests, nextLeaveYear, holidays);
    return (nextYearAllowed - usedInNextYear) >= requestedDays;
  }
  
  let totalAvailable = 0;
  const usedDaysOverall = getUsedDays(userId, vacationRequests, leaveType, holidays);

  switch (leaveType) {
    case 'unjustified': return true;
    case 'maternity':
      totalAvailable = user.maternityDaysTotal || user.maternity_days_total || 119;
      break;
    case 'paternity':
      totalAvailable = user.paternityDaysTotal || user.paternity_days_total || 14;
      break;
    case 'unpaid': return true;
    case 'mandatory': return true;
    default:
      totalAvailable = user.totalDays || user.total_days || 0;
  }
  
  return (totalAvailable - usedDaysOverall) >= requestedDays;
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('el-GR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'manager1_approved': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getLeaveTypeInfo = (leaveType) => {
  return LEAVE_TYPES[leaveType] || LEAVE_TYPES.vacation;
};

export const isGreekHoliday = (date, holidays) => {
  if (!holidays || !Array.isArray(holidays)) return null;
  const checkDate = new Date(date);
  const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
  
  const holiday = holidays.find(h => {
    const holidayDate = new Date(h.holiday_date);
    const holidayStr = `${holidayDate.getFullYear()}-${String(holidayDate.getMonth() + 1).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`;
    return holidayStr === dateStr;
  });
  
  return holiday || null;
};