const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, LISTEN_PORT } = require('./constants');
const { FAIL_LOGIN_MESSAGE, SUCCESS, SERVER_ERROR } = require('./messages');

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const app = express();

const JWT_SECRET = 'SECRET_KEY=mySuperSecretKey1234567890!@#$%^&*()'

// PostgreSQL connection
const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_NAME,
  password: DB_PASS,
  port: DB_PORT
});


// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(bodyParser.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.static('public')); // Serve static files (HTML, CSS, etc.)

// Middleware to verify JWT
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    console.log("TOKEN: ", token);
    
    if (!token) return res.sendStatus(401); // Unauthorized
  
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403); // Forbidden
      req.user = user; // Attach the user object to the request
      next(); // Call next to proceed to the next middleware/route
    });
}

// Register page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'src/dashboard.html'));
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'src/login.html'));
});

// Register page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'src/register.html'));
});

// Dashboard welcome route that requires authentication
app.get('/dashboard/welcome', authenticateToken, (req, res) => {
    res.json({ message: 'Welcome to your dashboard!', user: req.user });
});


// Get Report
app.get('/userReport', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT gender, COUNT(*) AS count
            FROM registered_user
            GROUP BY gender
        `);
        
        const counts = result.rows.reduce((acc, row) => {
            acc[row.gender] = parseInt(row.count, 10);
            return acc;
        }, { Male: 0, Female: 0}); // Initialize counts

        res.json(counts);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: SERVER_ERROR });
    }
});

// Dashboard welcome route that requires authentication
app.get('/userDefinition', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id, 
                first_name, 
                last_name, 
                username, 
                tc, 
                date_of_birth, 
                gender, 
                is_military, 
                military_date, 
                phone_number, 
                email, 
                registration_date, 
                modified_date 
            FROM registered_user
        `);
        res.json(result.rows); // Send the fetched data as JSON response
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: SERVER_ERROR });
    }
});

// Dashboard welcome route that requires authentication
app.post('/userDefinition', authenticateToken, async (req, res) => {
    const {
        firstName = null,
        lastName = null,
        username = null,
        tc = null,
        birthdate = null,
        gender = null,
        militaryStatus = null,
        militaryDate = null,
        phone = null,
        email = null,
        password = null
    } = req.body;
    
    console.log(req.body);

    const query = `
        INSERT INTO registered_user (
            first_name, 
            last_name, 
            username, 
            tc, 
            date_of_birth, 
            gender, 
            is_military, 
            military_date, 
            phone_number, 
            email,
            password
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
    `;
    const values = [
        firstName || null,
        lastName || null,
        username || null,
        tc || null,
        birthdate || null,
        gender || null,
        militaryStatus || null,
        militaryDate || null,
        phone || null,
        email || null,
        password || null
    ];

    try {
        const result = await pool.query(query, values);
        return res.status(200).json({
            success: true,
            user: result.rows[0],
            message: 'User created successfully!'
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
});

// Handle login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(username, password)
  
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: FAIL_LOGIN_MESSAGE }); 
        } 

        const user = result.rows[0];  
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: FAIL_LOGIN_MESSAGE }); 
        }

        // Create and assign a JWT
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h', });
        return res.json({ token });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: SERVER_ERROR });
    }
  });

// Register a new user
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  try {
    const userCheckQuery = 'SELECT * FROM users WHERE username = $1 OR email = $2';
    const result = await pool.query(userCheckQuery, [username, email]);

    if (result.rows.length > 0) {
      const existingUser = result.rows[0];
      if (existingUser.username === username) {
        return res.status(409).json({ error: 'Username already exists.' }); 
      } 
      if (existingUser.email === email) {
        return res.status(409).json({ error: 'Email already exists.' });
      }
    }

    // Proceed to create the new user
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password, email) VALUES ($1, $2, $3)', [username, hashedPassword, email]);
    res.status(200).json({ message: SUCCESS}); 
  } catch (err) {
    console.error(err.detail);
    res.status(500).send(SERVER_ERROR);
  }
});

// Start the server
const server = app.listen(LISTEN_PORT, () => {
  console.log(`Server running on port ${LISTEN_PORT}`);
});

// Gracefully stop the server when Ctrl+C (SIGINT) is pressed
process.on('SIGINT', () => {
    console.log('\nShutting down the server...');
    server.close((err) => {
        if (err) {
            console.error('Error during server shutdown:', err);
            process.exit(1); // Exit with an error code
        }
        console.log('Server stopped');
        process.exit(0); // Exit the process
    });
  });