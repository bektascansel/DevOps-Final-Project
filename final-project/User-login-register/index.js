import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import Redis from "ioredis";
import connectRedis from "connect-redis";
import mysql from "mysql2";

dotenv.config();

const port = 4050;
const app = express();
const RedisStore = connectRedis(session);
const redis = new Redis({
  host: 'redis', 
  port: 6379,    
});

const dbConnection = mysql.createPool({
  connectionLimit: 10,
  host: "db",
  user: "root",
  password: "password",
  database: "db",
});

dbConnection.getConnection((err, connection) => {
  if (err) {
    console.log("Error connecting to database");
  } else {
    console.log("Connected to database");
  }
});

app.use(
  session({
    name: process.env.COOKIE_NAME,
    store: new RedisStore({
      client: redis,
      disableTouch: true,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: !process.env.NODE_ENV === "production",
    },
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.json());



app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const sql = `SELECT * FROM Users WHERE username = ? AND password = ?`;
  dbConnection.query(sql, [username, password], (err, result) => {
    if (err) {
      console.error('Database error:', err.stack);
      res.status(500).json({ message: "Database error" });
      return;
    }
    if (result.length === 0) {
      res.status(401).json({ message: "The entered username or password is incorrect. Please try again." });
    } else {
      const user = result[0];
      req.session.user = user;
      res.status(200).json({ message: "You have successfully logged in. Welcome!" });
    }
  });
});




app.get("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return res.status(401).json({ message: "Logout failed. Please try again." });
    }
    res.clearCookie(process.env.COOKIE_NAME);
    return res.status(200).json({ message: "You have successfully logged out. Goodbye!" });
  });
});




app.post('/register', (req, res) => {
  const { name, surname, username, password } = req.body;
  const _sql = `SELECT name, surname, username FROM Users WHERE username = ?`;
  dbConnection.query(_sql, [username], (err, result) => {
    if (err) {
      console.error('Database error:', err.stack);
      res.status(500).json({ message: 'Database error' });
      return;
    }
    if (result.length > 0) {
      res.status(500).json({ message: "The entered username is already in use. Please try another username." });
    } else {
      const sql = `INSERT INTO Users (name, surname, username, password) VALUES (?, ?, ?, ?)`;
      dbConnection.query(sql, [name, surname, username, password], (err, result) => {
        if (err) {
          console.error("User could not be added:", err.stack);
          res.status(500).json({ message: "User could not be added" });
          return;
        }
        console.log("New user added:", result);
        res.status(201).json({ message: "The user registration has been successfully created." });
      });
    }
  });
});




app.listen(port, () => {
  console.log("Listening on port 4050");
});
