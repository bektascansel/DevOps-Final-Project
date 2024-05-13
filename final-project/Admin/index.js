import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import Redis from "ioredis";
import connectRedis from "connect-redis";
import mysql from "mysql2";

dotenv.config();

const port = 4060;
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




app.get('/users/getAll', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Authentication required." });
  }
  if (req.session.user.username !== "admin") {
    return res.status(403).json({ message: "Forbidden. Only admin can access this resource." });
  }
  const sql = `SELECT name, surname, username FROM Users`;
  dbConnection.query(sql, (err, results) => {
    if (err) {
      console.error("Users could not be listed:", err.stack);
      res.status(500).json({ message: "Users could not be listed" });
      return;
    }
    const userList = results.map(user => ({
      id: user.id,
      name: user.name,
      surname: user.surname,
      username: user.username
    }));
    console.log("Users have been successfully listed:", userList);
    res.status(200).json({ message: "Users have been successfully listed", users: userList });
  });
});




app.post('/books/create', (req, res) => {
    const { BookName, BookDescription, BookPrice, BookStock } = req.body;
    if (!req.session.user) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (req.session.user.username !== "admin") {
      return res.status(403).json({ message: "Forbidden. Only admin can access this resource." });
    }
    dbConnection.query("SELECT COUNT(*) AS count FROM Books WHERE name = ?", [BookName], (err, results) => {
      if (err) {
        console.error('Database query error:', err.stack);
        return res.status(500).json("Database's Error" + err.stack);
      }
      const bookCount = results[0].count;
      if (bookCount > 0) {
        return res.status(400).json({ message: "The entered BookName is already in use. Please try another BookName." });
      }
      const sql = 'INSERT INTO Books (name, description, price, stock) VALUES (?, ?, ?, ?)';
      dbConnection.query(sql, [BookName, BookDescription, BookPrice, BookStock], (err, result) => {
        if (err) {
          console.error('Database query error:', err.stack);
          return res.status(500).json("Database's Error" + err.stack);
        }
        console.log("New book added");
        redis.del('books:all', (redisDelErr, reply) => {
          if (redisDelErr) {
            console.error("Redis error:", redisDelErr);
          } else {
            console.log("Redis cache cleared");
          }
        });
        res.status(201).json({ message: 'New book added.' });
      });
    });
  });



  app.get('/orders', (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (req.session.user.username !== "admin") {
      return res.status(403).json({ message: "Forbidden. Only admin can access this resource." });
    }
    dbConnection.query("SELECT * FROM Orders", (err, results) => {
      if (err) {
        console.error('Database query error:', err.stack);
        return res.status(500).json("Database's Error" + err.stack);
      }
      if (!results || results.length === 0) {
        return res.status(404).json({ message: 'Orders Not Exist' });
      }
      const orders = results.map(order => ({
        id: order.id,
        userId: order.userId,
        bookId: order.bookId,
        quantity: order.quantity
      }));
      return res.status(200).json({ message: "Orders Successfully Listed", orders: orders });
    });
  });
  




  

app.listen(port, () => {
  console.log("Listening on port 4060");
});
