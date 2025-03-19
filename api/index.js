const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
   
const app = express();
app.use(express.json());
app.use(cors());

// ✅ MySQL Connection (use connection pooling for scalability)


const pool = mysql.createPool({
  host: "3.7.158.221",
  user: "admin_buildINT",
  password: "buildINT@2023$",
  database: "HFTA",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

 
// ✅ Test Database Connection
async function testDBConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL database");
    connection.release();
  } catch (error) {
    console.error("Database connection error:", error.message);
  }
}
testDBConnection();


// ✅ Route: Root for Testing
app.get("/", (req, res) => {
  res.send("API is running...");
});

// ✅ Route: User Registration

app.post("/createHFTA", (req, res) => {
  const {
    FirstName, MiddleName, LastName, CurrentBelt, EmailID, Contact,
    AlternativeContact, GuardianName, Address, Gender, DateOfJoining,
    Password, Role, Username
  } = req.body;

  if (!FirstName || !LastName || !EmailID || !Contact || !Password || !DateOfJoining || !Username) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  bcrypt.hash(Password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ message: "Error encrypting password" });

    const query = `
      INSERT INTO user (FirstName, MiddleName, LastName, CurrentBelt, EmailID, Contact,
                        AlternativeContact, GuardianName, Address, Gender, DateOfJoining,
                        Password, Role, Username)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [FirstName, MiddleName, LastName, CurrentBelt, EmailID, Contact,
                    AlternativeContact, GuardianName, Address, Gender, DateOfJoining,
                    hashedPassword, Role, Username];

    pool.query(query, values, (err, result) => {
      if (err) return res.status(500).json({ message: "Database error", error: err.sqlMessage });
      res.status(201).json({ message: "User created successfully", userId: result.insertId });
    });
  });
});

// ✅ Route: User Login
app.post('/login', async (req, res) => {
    try {
        const { Username, Password } = req.body;

        if (!Username || !Password) {
            return res.status(400).json({ message: 'Username and Password are required' });
        }

        // Fetch user details
        const query = 'SELECT * FROM user WHERE Username = ?';
        const [result] = await pool.query(query, [Username]);

        if (result.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result[0];

        // Compare hashed password
        const isMatch = await bcrypt.compare(Password, user.Password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.userId, Username: user.Username, Role: user.Role },
            process.env.JWT_SECRET || 'your_jwt_secret_key',  // Use env variable for security
            { expiresIn: '96h' }
        );

        // Calculate expiration time (96 hours from now)
        const expirationTime = new Date(Date.now() + 96 * 60 * 60 * 1000);

        // Store token in the database
        const updateQuery = 'UPDATE user SET Token = ?, expire_token = ? WHERE Username = ?';
        await pool.query(updateQuery, [token, expirationTime, Username]);

        res.status(200).json({
            message: 'Login successful',
            Token: token,
            expire_token: expirationTime,
            Role: user.Role,
            Username: user.Username
        });

    } catch (err) {
        console.error("Database Error:", err.message);
        res.status(500).json({ message: 'Database error', error: err.message });
    }
});



// ✅ Route: Fetch Attendance Records
app.get("/Attendances", async (req, res) => {
  try {
    const query = "SELECT * FROM Attendance ORDER BY Id DESC";

    // ✅ Use async/await properly
    const [result] = await pool.query(query);

    if (result.length === 0) {
      return res.status(404).json({ message: "No attendance records found" });
    }

    res.status(200).json({ message: "Attendance records retrieved", data: result });
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err.message });
  }
});

// ✅ Route: Fetch User Details
app.get("/UsersDetails", async (req, res) => {
  try {
    const query = "SELECT ID, Role, Username, Contact, CurrentBelt FROM HFTA.user WHERE Role IN ('Student', 'Instructor') ORDER BY 1 DESC";
    
    const [result] = await pool.query(query); // Use await for async query execution

    res.status(200).json({ message: "User records retrieved", data: result });
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err.message });
  }
});


app.get("/attendance-stats", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

    const totalUsersQuery = "SELECT COUNT(DISTINCT Username) AS totalStudents FROM user";
    const presentQuery = `SELECT COUNT(DISTINCT Username) AS totalPresent FROM Attendance 
                          WHERE AttandanceStatus = 1 AND DATE(Time) = ?`;

    // ✅ Execute queries using await
    const [userResult] = await pool.query(totalUsersQuery);
    const totalStudents = userResult[0].totalStudents;

    const [presentResult] = await pool.query(presentQuery, [today]);
    const totalPresent = presentResult[0].totalPresent;

    const percentagePresent = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;
    const percentageNotPresent = 100 - percentagePresent;

    res.json({
      totalStudents,
      totalPresent,
      percentagePresent: `${percentagePresent.toFixed(2)}%`,
      percentageNotPresent: `${percentageNotPresent.toFixed(2)}%`
    });

  } catch (err) {
    res.status(500).json({ message: "Database error", error: err.message });
  }
});

app.get('/getHFTA/:username',async (req, res) => {
  const { username } = req.params;

  if (!username) {
      return res.status(400).json({ message: 'Username is required' });
  }
  try{
  const query = `
      SELECT FirstName, MiddleName, LastName, CurrentBelt, EmailID, Contact, 
             AlternativeContact, GuardianName, Address, Gender, DateOfJoining, Role, Username
      FROM user
      WHERE Username = ?`;
  const [result] = await pool.query(query, [username]);

  if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
  }
  res.status(200).json(result[0]);
} catch (err) {
  res.status(500).json({ message: 'Database error', error: err.message });
}
});

app.post('/Attendance', async (req, res) => {
  try{
  const { Username, Days, Time, Loaction, Decrptions,AttandanceStatus } = req.body;

  if (!Username || !Days || !Time || !Loaction || !Decrptions) {
      return res.status(400).json({ message: 'Required fields are missing' });
  }

  // Check if the user already has an entry for the given day
  const checkQuery = 'SELECT * FROM Attendance WHERE Username = ? AND Days = ?';
  const [result] = await pool.query(checkQuery, [Username, Days]);
  if (result.length > 0) {
      return res.status(409).json({ message: 'Attendance already marked for this day' });
  }
  
      // If no entry exists, insert the new attendance record
      const insertQuery = 'INSERT INTO Attendance (Username, Days, Time, Loaction, Decrptions,AttandanceStatus) VALUES (?,?, ?, ?, ?, ?)';
      await pool.query(insertQuery, [Username, Days, Time, Loaction, Decrptions,AttandanceStatus || 1 ]);
      res.status(201).json({ message: 'Attendance marked successfully' });
  } catch (err) { 
      res.status(500).json({ message: 'Database error', error: err.message });
  }
});

module.exports = app;

