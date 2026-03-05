import React, { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import DepartmentFilter from './DepartmentFilter';

const YearlyBalanceView = ({ annualBalances = [], departments = [], userDatabase = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartments, setSelectedDepartments] = useState([]);

    useEffect(() => {
        if (departments.length > 0 && selectedDepartments.length === 0) {
            setSelectedDepartments(departments.map(d => d.id));
        }
    }, [departments]);

    const filteredData = useMemo(() => {
        if (!annualBalances || !Array.isArray(annualBalances)) return [];

        return annualBalances.filter(item => {
            const name = item?.name || "";
            const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
            const userId = item?.userId || item?.user_id;
            const userInDb = userDatabase?.find(u => u.id === userId);
            const deptId = item?.departmentId || item?.department_id || userInDb?.department_id || userInDb?.departmentId;
            const matchesDept = selectedDepartments.length === 0 || selectedDepartments.includes(Number(deptId));

            return matchesSearch && matchesDept;
        });
    }, [annualBalances, searchTerm, selectedDepartments, userDatabase]);

    const getBalanceColor = (value) => {
        const numValue = Number(value) || 0;
        return numValue === 0 ? 'text-green-600' : 'text-red-600';
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
            <div className="bg-white rounded-xl border shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase xs:text-[12px] xs:px-2 xs:py-2 sm:text-[18px]">Υπάλληλος</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase xs:text-[12px] xs:px-2 xs:py-2 sm:text-lg">2024</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase xs:text-[12px] xs:px-2 xs:py-2 sm:text-lg">2025</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase xs:text-[12px] xs:px-2 xs:py-2 sm:text-lg">2026</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 xs:text-[10px]">
                            {filteredData.length > 0 ? (
                                filteredData.map((row) => (
                                    <tr key={row.userId || row.user_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900 border-r">{row.name}</td>
                                        <td className={`px-6 py-4 text-center font-bold ${getBalanceColor(row.balance_2024)}`}>
                                            {row.balance_2024 ?? 0}
                                        </td> 
                                        <td className={`px-6 py-4 text-center font-bold ${getBalanceColor(row.balance_2025)}`}>
                                            {row.balance_2025 ?? 0}
                                        </td>
                                        <td className={`px-6 py-4 text-center font-bold ${getBalanceColor(row.balance_2026)}`}>
                                            {row.balance_2026 ?? 0}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-10 text-center text-gray-400">
                                        {annualBalances.length === 0 
                                            ? "Δεν υπάρχουν δεδομένα στη βάση." 
                                            : "Δεν βρέθηκαν αποτελέσματα για τα φίλτρα σας."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default YearlyBalanceView;