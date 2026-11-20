import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getEmployeeShifts } from '../../api/usersApi';
import Pagination from '../../components/shared/Pagination';
import { getManilaDateOnly } from '../../utils/dateUtils';

const EmployeeTracker = () => {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateStr, setDateStr] = useState(() => getManilaDateOnly());
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const totalPages = Math.max(1, Math.ceil(shifts.length / itemsPerPage));
  const paginatedShifts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return shifts.slice(start, start + itemsPerPage);
  }, [shifts, currentPage, itemsPerPage]);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEmployeeShifts(dateStr);
      setShifts(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load shifts. Ensure the employee_shifts table exists in Supabase.');
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const calculateHours = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return 'Ongoing';
    const ms = new Date(clockOut) - new Date(clockIn);
    const hrs = ms / (1000 * 60 * 60);
    return `${hrs.toFixed(2)}h`;
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Employee Tracker</h1>
        <p>Monitor employee attendance and daily shifts.</p>
      </div>

      <div className="card">
        <div className="card-header tracker-header">
          <h2>Shift Records</h2>
          <input 
            type="date" 
            value={dateStr} 
            onChange={(e) => { setDateStr(e.target.value); setCurrentPage(1); }}
            className="tracker-date-input"
          />
        </div>
        <div className="card-body">
          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}
          {loading ? (
            <p>Loading records...</p>
          ) : shifts.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Role</th>
                    <th>Shift Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedShifts.map(shift => (
                    <tr key={shift.id}>
                      <td><strong>{shift.users?.name || 'Unknown'}</strong></td>
                      <td>{shift.users?.role || 'Staff'}</td>
                      <td>{shift.shift_date}</td>
                      <td>
                        {shift.clock_in ? new Date(shift.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                      </td>
                      <td>
                        {shift.clock_out ? new Date(shift.clock_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                      </td>
                      <td><strong>{calculateHours(shift.clock_in, shift.clock_out)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={shifts.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(val) => {
                  setItemsPerPage(val);
                  setCurrentPage(1);
                }}
                itemsPerPageOptions={[10, 20, 50]}
              />
            </div>
          ) : (
            <div className="empty-state">
              <p>No shift records found for the selected date.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeTracker;
