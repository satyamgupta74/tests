const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
   
const app = express();
app.use(express.json());
app.use(cors());

// ✅ MySQL Connection (use connection pooling for scalability)
const mysql = require("mysql2/promise");

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
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("✅ Connected to MySQL database");
    connection.release();
  }
});

// ✅ Rou
app.get("/", (req, res) => {
  res.send("API is running...");
});

te: User Registration
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
app.post("/login", (req, res) => {
  const { Username, Password } = req.body;
  if (!Username || !Password) return res.status(400).json({ message: "Username and Password required" });

  const query = "SELECT * FROM user WHERE Username = ?";
  pool.query(query, [Username], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (result.length === 0) return res.status(404).json({ message: "User not found" });

    const user = result[0];
    bcrypt.compare(Password, user.Password, (err, isMatch) => {
      if (err || !isMatch) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ userId: user.userId, Username: user.Username }, "your_jwt_secret_key", { expiresIn: "96h" });

      res.status(200).json({ message: "Login successful", token, Role: user.Role, Username: user.Username });
    });
  });
});

// ✅ Route: Fetch Attendance Records
app.get("/Attendances", (req, res) => {
  const query = "SELECT * FROM Attendance ORDER BY Id DESC";
  pool.query(query, (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (result.length === 0) return res.status(404).json({ message: "No attendance records found" });
    res.status(200).json({ message: "Attendance records retrieved", data: result });
  });
});

// ✅ Route: Fetch User Details
app.get("/UsersDetails", (req, res) => {
  const query = "SELECT ID, Role, Username, Contact, CurrentBelt FROM HFTA.user WHERE Role IN ('Student', 'Instructor') ORDER BY 1 DESC";
  pool.query(query, (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.status(200).json({ message: "User records retrieved", data: result });
  });
});

module.exports = app;

