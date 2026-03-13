const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();
const emailService = require('./emailService');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'https://planmyleave.dromeas.gr'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vacation_system',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let db;

const initializeDatabase = async () => {
  try {
    db = await mysql.createPool(dbConfig);
    const connection = await db.getConnection();
    await connection.ping();
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, error: 'Απαιτείται σύνδεση' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ success: false, error: 'Μη έγκυρο ή ληγμένο token' });
    }
    req.user = user;
    next();
  });
};

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    emailEnabled: !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD)
  });
});

app.get('/api/holidays', async (req, res) => {
  try {
    const { year } = req.query;
    let query = 'SELECT * FROM greek_holidays';
    let params = [];
    
    if (year) {
      query += ' WHERE year = ?';
      params.push(year);
    }
    
    query += ' ORDER BY holiday_date';
    
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Λείπουν στοιχεία σύνδεσης'
      });
    }
    
    // Fetch user by username only — password check done via bcrypt below
    const [rows] = await db.execute(`
      SELECT u.*, d.name as department_name, d.color as department_color
      FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.username = ?
    `, [username]);

    // Verify password using bcrypt
    const passwordMatch = rows.length > 0
      ? await bcrypt.compare(password, rows[0].password)
      : false;

    if (rows.length > 0 && passwordMatch) {
      const user = rows[0];

      // April 1st refresh logic
      const now = new Date();
      const currentYear = now.getFullYear();
      const cycleStartYear = now.getMonth() < 3 ? currentYear - 1 : currentYear;

      const [existingBalance] = await db.execute(
        'SELECT * FROM user_annual_balances WHERE user_id = ? AND cycle_start_year = ?',
        [user.id, cycleStartYear]
      );

      if (existingBalance.length === 0) {
        await db.execute(
          'INSERT INTO user_annual_balances (user_id, cycle_start_year, total_allowed) VALUES (?, ?, ?)',
          [user.id, cycleStartYear, user.total_days || 25]
        );
      }

      const [annualBalances] = await db.execute(
        'SELECT cycle_start_year, total_allowed, carried_over FROM user_annual_balances WHERE user_id = ? ORDER BY cycle_start_year DESC',
        [user.id]
      );

      // Generate JWT token — expires in 8 hours
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          totalDays: user.total_days,
          sickDaysTotal: user.sick_days_total || 10,
          maternityDaysTotal: user.maternity_days_total,
          paternityDaysTotal: user.paternity_days_total,
          department: user.department_name,
          departmentId: user.department_id,
          departmentColor: user.department_color,
          role: user.role,
          managerId: user.manager_id,
          managerLevel: user.manager_level, 
          gender: user.gender,
        },
        annualBalances
      });
    } else {
      res.json({
        success: false,
        error: 'Λανθασμένο όνομα Χρήστη ή/και κωδικός'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Σφάλμα σύνδεσης. Παρακαλώ δοκιμάστε ξανά.'
    });
  }
});

app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM departments ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT u.*, d.name as department_name, d.color as department_color
      FROM users u
      JOIN departments d ON u.department_id = d.id
      ORDER BY u.name
    `);
    res.json(rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/vacation-requests', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT vr.*, 
            u.name as user_name, 
            d.name as department_name, 
            d.color as department_color,
            reviewer.name as reviewer_name,
            vr.manager_granted,
            vr.manager1_id,
            vr.manager1_status,
            vr.manager1_decision_date,
            vr.manager2_id,
            vr.manager2_status,
            vr.manager2_decision_date,
            m1.name as manager1_name,
            m2.name as manager2_name
      FROM vacation_requests vr
      JOIN users u ON vr.user_id = u.id
      JOIN departments d ON u.department_id = d.id
      LEFT JOIN users reviewer ON vr.reviewed_by = reviewer.id
      LEFT JOIN users m1 ON vr.manager1_id = m1.id
      LEFT JOIN users m2 ON vr.manager2_id = m2.id
      ORDER BY vr.created_at DESC
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('Get vacation requests error:', error);
    res.status(500).json({ error: 'Failed to fetch vacation requests' });
  }
});

app.get('/api/vacation-requests/upcoming/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await db.execute(`
      SELECT vr.*, u.name as user_name
      FROM vacation_requests vr
      JOIN users u ON vr.user_id = u.id
      WHERE vr.user_id = ? AND vr.status = 'approved' AND vr.start_date >= CURDATE()
      ORDER BY vr.start_date ASC
    `, [userId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Get upcoming requests error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming requests' });
  }
});

app.get('/api/annual-balances', authenticateToken, async (req, res) => {
  const query = `
    SELECT 
      u.id as userId,
      u.name as name,
      MAX(CASE WHEN ab.cycle_start_year = 2024 THEN ab.total_allowed ELSE 0 END) AS balance_2024,
      MAX(CASE WHEN ab.cycle_start_year = 2025 THEN ab.total_allowed ELSE 0 END) AS balance_2025,
      MAX(CASE WHEN ab.cycle_start_year = 2026 THEN ab.total_allowed ELSE 0 END) AS balance_2026
    FROM users u
    LEFT JOIN user_annual_balances ab ON u.id = ab.user_id
    WHERE u.role != 'admin'
    GROUP BY u.id, u.name
    ORDER BY u.name ASC
  `;

  try {
    const [results] = await db.execute(query);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.post('/api/vacation-requests', authenticateToken, async (req, res) => {
  try {
    const { userId, startDate, endDate, reason, leaveType } = req.body;
    
    if (!userId || !startDate || !endDate || !reason || !leaveType) {
      return res.status(400).json({
        success: false,
        error: 'Λείπουν απαραίτητα στοιχεία'
      });
    }
    
    const validLeaveTypes = ['vacation', 'sick', 'maternity', 'paternity', 'unpaid', 'unjustified'];
    if (!validLeaveTypes.includes(leaveType)) {
      return res.status(400).json({
        success: false,
        error: 'Μη έγκυρος τύπος άδειας'
      });
    }
    
    const [userRows] = await db.execute(
      'SELECT u.*, m.email as manager_email, m.name as manager_name FROM users u LEFT JOIN users m ON u.manager_id = m.id WHERE u.id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Χρήστης δεν βρέθηκε'
      });
    }
    
    const user = userRows[0];
    
    const [result] = await db.execute(`
      INSERT INTO vacation_requests (user_id, start_date, end_date, reason, leave_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [userId, startDate, endDate, reason, leaveType]);
    
    if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      if (user.email) {
        await emailService.sendRequestSubmittedEmail(
          user.email, user.name, startDate, endDate, reason
        );
      }
      if (user.manager_email && user.manager_name) {
        await emailService.sendManagerNotificationEmail(
          user.manager_email, user.manager_name, user.name, startDate, endDate, reason
        );
      }
    }
    
    res.json({ success: true, requestId: result.insertId });
  } catch (error) {
    console.error('Create vacation request error:', error);
    res.status(500).json({
      success: false,
      error: 'Αποτυχία υποβολής αίτησης. Παρακαλώ δοκιμάστε ξανά.'
    });
  }
});

app.put('/api/vacation-requests/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewerId, managerLevel } = req.body;

    if (!status || !reviewerId) {
      return res.status(400).json({ success: false, error: 'Λείπουν απαραίτητα στοιχεία' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Μη έγκυρη κατάσταση' });
    }

    const [requestRows] = await db.execute(`
      SELECT vr.*, u.email AS user_email, u.name AS user_name, u.manager_id
      FROM vacation_requests vr
      JOIN users u ON vr.user_id = u.id
      WHERE vr.id = ?
    `, [id]);

    if (requestRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Αίτηση δεν βρέθηκε' });
    }

    const request = requestRows[0];
    const now = new Date();

    const [managerRows] = await db.execute('SELECT name FROM users WHERE id = ?', [reviewerId]);
    const managerName = managerRows[0]?.name || 'Διαχειριστής';
    let currentManagerLevel = managerLevel || 1;

    if (parseInt(reviewerId) === 40) {
      currentManagerLevel = 2;
    }

    if (currentManagerLevel === 1) {
      if (status === 'approved') {
        await db.execute(`
          UPDATE vacation_requests 
          SET manager1_id = ?,
              manager1_status = 'manager1_approved',
              manager1_decision_date = ?,
              status = 'manager1_approved',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [reviewerId, now, id]);

        if (process.env.SMTP_USER && request.user_email) {
          await emailService.sendRequestApprovedEmail(
            request.user_email, request.user_name, request.start_date, request.end_date, `${managerName} (Επίπεδο 1)`
          );
        }

        return res.json({ success: true, message: 'Εγκρίθηκε από Manager 1 – σε αναμονή Manager 2', newStatus: 'manager1_approved' });

      } else {
        await db.execute(`
          UPDATE vacation_requests 
          SET manager1_id = ?,
              manager1_status = 'manager1_rejected',
              manager1_decision_date = ?,
              status = 'manager1_rejected',
              reviewed_by = ?,
              reviewed_date = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [reviewerId, now, reviewerId, now, id]);

        if (process.env.SMTP_USER && request.user_email) {
          await emailService.sendRequestRejectedEmail(
            request.user_email, request.user_name, request.start_date, request.end_date, `${managerName} (Επίπεδο 1)`
          );
        }

        return res.json({ success: true, message: 'Απορρίφθηκε από Manager 1', newStatus: 'manager1_rejected' });
      }
    }

    if (currentManagerLevel === 2) {
      if (status === 'approved') {
        await db.execute(`
          UPDATE vacation_requests 
          SET manager2_id = ?,
              manager2_status = 'manager2_approved',
              manager2_decision_date = ?,
              status = 'approved',
              reviewed_by = ?,
              reviewed_date = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [reviewerId, now, reviewerId, now, id]);

        if (process.env.SMTP_USER && request.user_email) {
          await emailService.sendRequestApprovedEmail(
            request.user_email, request.user_name, request.start_date, request.end_date, `${managerName} (Τελική Έγκριση)`
          );
        }

        return res.json({ success: true, message: 'Τελική έγκριση από Manager 2', newStatus: 'approved' });

      } else {
        await db.execute(`
          UPDATE vacation_requests 
          SET manager2_id = ?,
              manager2_status = 'manager2_rejected',
              manager2_decision_date = ?,
              status = 'rejected',
              reviewed_by = ?,
              reviewed_date = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [reviewerId, now, reviewerId, now, id]);

        if (process.env.SMTP_USER && request.user_email) {
          await emailService.sendRequestRejectedEmail(
            request.user_email, request.user_name, request.start_date, request.end_date, `${managerName} (Επίπεδο 2)`
          );
        }

        return res.json({ success: true, message: 'Απόρριψη από Manager 2', newStatus: 'rejected' });
      }
    }

    return res.status(400).json({ success: false, error: 'Μη έγκυρο επίπεδο διαχειριστή' });

  } catch (error) {
    console.error('Update vacation request error:', error);
    res.status(500).json({ success: false, error: 'Αποτυχία ενημέρωσης αίτησης. Παρακαλώ δοκιμάστε ξανά.' });
  }
});

app.get('/api/vacation-requests/pending/:managerId', authenticateToken, async (req, res) => {
  try {
    const { managerId } = req.params;

    const [manager] = await db.execute('SELECT manager_level FROM users WHERE id = ?', [managerId]);

    if (manager.length === 0) {
      return res.status(404).json({ success: false, error: 'Διαχειριστής δεν βρέθηκε' });
    }

    let managerLevel = manager[0].manager_level;

    if (parseInt(managerId) === 40) {
      managerLevel = 2;
    }

    let query;
    let params = [];

    if (managerLevel === 1) {
      query = `
        SELECT vr.*, 
               u.name as user_name, 
               d.name as department_name, 
               d.color as department_color
        FROM vacation_requests vr
        JOIN users u ON vr.user_id = u.id
        JOIN departments d ON u.department_id = d.id
        WHERE u.manager_id = ?
        AND vr.status = 'pending'
        ORDER BY vr.created_at ASC
      `;
      params = [managerId];

    } else if (managerLevel === 2) {
      query = `
        SELECT vr.*, 
               u.name as user_name, 
               d.name as department_name, 
               d.color as department_color,
               m1.name as manager1_name
        FROM vacation_requests vr
        JOIN users u ON vr.user_id = u.id
        JOIN departments d ON u.department_id = d.id
        LEFT JOIN users m1 ON vr.manager1_id = m1.id
        WHERE vr.status = 'manager1_approved'
        ORDER BY vr.created_at ASC
      `;
    }

    const [rows] = await db.execute(query, params);
    res.json(rows);

  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

app.post('/api/grant', authenticateToken, async (req, res) => {
  try {
    const { userIds, days, startDate, endDate, reason, grantedBy, isDeduction } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Λείπουν χρήστες' });
    }
    if (!days || days <= 0) {
      return res.status(400).json({ success: false, error: 'Μη έγκυρος αριθμός ημερών' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Λείπει αιτιολογία' });
    }
    
    if (isDeduction) {
      const now = new Date().toISOString().split('T')[0];
      for (const userId of userIds) {
        await db.execute(
          `INSERT INTO vacation_requests 
           (user_id, start_date, end_date, reason, leave_type, status, reviewed_by, reviewed_date, manager_granted, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, startDate, endDate, reason, 'mandatory', 'approved', grantedBy, now, 1, now]
        );
      }    
    } else {
      const placeholders = userIds.map(() => '?').join(',');
      await db.execute(
        `UPDATE users SET total_days = total_days + ? WHERE id IN (${placeholders})`,
        [days, ...userIds]
      );
    } 
    res.json({ success: true });
  } catch (error) {
    console.error('Grant days error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3001;

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
