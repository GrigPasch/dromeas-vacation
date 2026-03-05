import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown } from 'lucide-react';

const DepartmentFilter = ({ departments, selectedDepartments, onDepartmentChange, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleDepartmentToggle = (departmentId) => {
    const updatedSelected = selectedDepartments.includes(departmentId)
      ? selectedDepartments.filter(id => id !== departmentId)
      : [...selectedDepartments, departmentId];
    
    onDepartmentChange(updatedSelected);
  };

  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) {
      onDepartmentChange([]);
    } else {
      onDepartmentChange(departments.map(dept => dept.id));
    }
  };

  const getSelectedDepartmentNames = () => {
    if (selectedDepartments.length === 0) return 'Επιλέξτε Τμήματα';
    if (selectedDepartments.length === departments.length) return 'Όλα τα Τμήματα';
    if (selectedDepartments.length === 1) {
      const dept = departments.find(d => d.id === selectedDepartments[0]);
      return dept ? dept.name : '';
    }
    return `${selectedDepartments.length} Τμήματα`;
  };

  return (
    <div ref={dropdownRef} className={`relative z-10 ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px] shadow-sm transition-all"
      >
        <div className="flex items-center space-x-2 overflow-hidden">
          <Filter className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span className="truncate">{getSelectedDepartmentNames()}</span>
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-80 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2">
            <button
              onClick={handleSelectAll}
              className="w-full px-3 py-2 text-sm text-left text-blue-600 hover:bg-blue-50 font-bold rounded mb-1 transition-colors"
            >
              {selectedDepartments.length === departments.length ? 'Αποεπιλογή Όλων' : 'Επιλογή Όλων'}
            </button>
            <div className="h-px bg-gray-100 my-1"></div>
            <div className="max-h-60 overflow-y-auto">
              {departments.map(department => (
                <label
                  key={department.id}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedDepartments.includes(department.id)}
                    onChange={() => handleDepartmentToggle(department.id)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center space-x-2 ml-3 overflow-hidden">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: department.color }}
                    ></div>
                    <span className="truncate">{department.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentFilter;