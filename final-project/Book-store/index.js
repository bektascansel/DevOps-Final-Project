import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import Redis from "ioredis";
import connectRedis from "connect-redis";
import mysql from "mysql2";
import amqp from "amqplib"


dotenv.config();

const app = express();
const port = 4070;

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


consumeRabbitMq();




app.get('/books/getAll', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Authentication required." });
  }
  const redisKey = 'books:all';
  redis.get(redisKey, (redisErr, booksData) => {
    if (redisErr) {
      console.error('Redis error:', redisErr);
    }
    if (booksData) {
      console.log("Data from Redis");
      const books = JSON.parse(booksData);
      return res.status(200).json({ message: "Books Successfully Listed (from Redis)", books: books });
    } else {
      console.log("Data from Database");
      dbConnection.query("SELECT * FROM Books", (dbErr, results) => {
        if (dbErr) {
          console.error('Database query error:', dbErr.stack);
          return res.status(500).json("Database's Error" + dbErr.stack);
        }
        if (!results || results.length === 0) {
          return res.status(404).json({ message: 'Books Not Exist' });
        }
        const books = results.map(book => ({
          BookId: book.id,
          BookName: book.name,
          BookDescription: book.description,
          BookPrice: book.price,
          BookStock: book.stock
        }));
        redis.set(redisKey, JSON.stringify(books), (redisSetErr, reply) => {
          if (redisSetErr) {
            console.error("Redis error:", redisSetErr);
          } else {
            console.log("Saved to Redis");
          }
        });
        return res.status(200).json({ message: "Books Successfully Listed (from Database)", books: books });
      });
    }
  });
});




app.get('/books/getById/:id', (req, res) => {
  const id = req.params.id;
  const redisKey = `books:id:${id}`;
  if (!req.session.user) {
    return res.status(401).json({ message: "Authentication required." });
  }
  redis.get(redisKey, (err, bookData) => {
    if (err) {
      console.error('Redis error:', err);
      return res.status(500).send("Server error");
    }
    if (bookData) {
      console.log("Data from Redis");
      const book = JSON.parse(bookData);
      return res.status(200).json({
        message: "Book Successfully Found (from Redis)",
        book: book
      });
    } else {
      console.log("Data from Database");
      dbConnection.query("SELECT * FROM Books WHERE id = ?", [id], (err, results) => {
        if (err) {
          console.error('Database query error:', err.stack);
          return res.status(500).json("Database's Error" + err.stack);
        }
        if (!results || results.length === 0) {
          return res.status(404).json({ message: 'Book Not Found' });
        }
        const book = results[0];
        const getBook = {
          id: book.id,
          BookName: book.name,
          BookDescription: book.description,
          BookPrice: book.price,
          BookStock: book.stock
        };
        redis.set(redisKey, JSON.stringify(getBook), (err, reply) => {
          if (err) {
            console.error("Redis error:", err);
          } else {
            console.log("Saved to Redis");
          }
        });
        return res.status(200).json({ message: "Book Successfully Found (from Database)", book: getBook });
      });
    }
  });
});




app.post('/buy', (req, res) => {
  const { bookId, quantity } = req.body;
  if (!req.session.user ) {
    return res.status(401).json({ message: "Authentication required." });
  }
  const userId = req.session.user.id;
  dbConnection.query("SELECT stock FROM Books WHERE id = ?", [bookId], (err, results) => {
    if (err) {
      console.error('Database query error:', err.stack);
      return res.status(500).json("Database's Error" + err.stack);
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Book not found.' });
    }
    const stock = results[0].stock;
    if (stock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock.' });
    }
    dbConnection.query("INSERT INTO Orders (userId, bookId, quantity) VALUES (?, ?, ?)", [userId, bookId, quantity], (err, results) => {
      if (err) {
        console.error('Database query error:', err.stack);
        return res.status(500).json("Database's Error" + err.stack);
      }
      const order={
        userId:userId,
        bookId:bookId,
        quantity:quantity
      }
      const orderJSON = JSON.stringify(order);
      sendRabbitMq(orderJSON)
      return res.status(201).json({ message: 'Order successfully placed.' });
    });
  });
});







async function sendRabbitMq(message){
  try{
      const connection = await amqp.connect('amqp://172.31.0.7');
      const channel= await connection.createChannel();
      await channel.assertQueue("OrdersQuery",{ durable: false })
      channel.sendToQueue("OrdersQuery", Buffer.from(message));
      } catch (error) {
          console.error("error:", error); 
      }
}





async function consumeRabbitMq() {
  try {
      const connection = await amqp.connect('amqp://172.31.0.7');
      const channel = await connection.createChannel();
      await channel.assertQueue("OrdersQuery", { durable: false });
      console.log("Waiting for messages in the queue...");
      channel.consume("OrdersQuery", async function (message) {
          if (message !== null) {
              try {
                  const parsedMessage = JSON.parse(message.content.toString()); 
                  const { bookId, quantity } = parsedMessage;       
                  const changeStock = `SELECT stock FROM Books WHERE id = ?`;
                  dbConnection.query(changeStock, [bookId], (err, results) => {
                      if (err) {
                          console.error('Database query error:', err.stack);
                          return;
                      }     
                      if (results && results.length > 0) {
                          const currentStock = results[0].stock;
                          const newStock = Math.max(currentStock - quantity, 0); 
                          const sqlUpdateStock = `UPDATE Books SET stock = ? WHERE id = ?`;
                          dbConnection.query(sqlUpdateStock, [newStock, bookId], (err, result) => {
                              if (err) {
                                  console.error('Database query error:', err.stack);
                                  return;
                              }
                              console.log(`Stock updated for bookId ${bookId}: ${newStock}`);

                              redis.del('books:all', (redisDelErr, reply) => {
                                if (redisDelErr) {
                                  console.error("Redis error:", redisDelErr);
                                } else {
                                  console.log("Redis cache cleared");
                                }
                              });         
                              redis.del(`books:id:${bookId}`, (redisDelErr, reply) => {
                                if (redisDelErr) {
                                    console.error("Redis error:", redisDelErr);
                                } else {
                                    console.log("Redis cache cleared");
                                }
                            });       
                          });
                      } else {
                          console.error(`Book with id ${bookId} not found in the database.`);
                      }
                  });

                  channel.ack(message);
              } catch (error) {
                  console.error('Error parsing message:', error);
              }
          }
      });
  } catch (error) {
      console.error("Error:", error);
  }
}





app.get('/myOrders', (req, res) => {
  if (!req.session.user) {
      return res.status(401).json({ message: "Authentication required." });
  }

  const userId = req.session.user.id;

  dbConnection.query("SELECT * FROM Orders WHERE userId = ?", [userId], (err, results) => {
      if (err) {
          console.error('Database query error:', err.stack);
          return res.status(500).json("Database's Error" + err.stack);
      }
      if (!results || results.length === 0) {
          return res.status(404).json({ message: 'Orders Not Exist' });
      }

      const orders = results.map(order => ({
          id: order.id,
          bookId: order.bookId,
          quantity: order.quantity
      }));

      return res.status(200).json({ message: "Orders Successfully Listed", orders: orders });
  });
});



app.listen(port, () => {
  console.log("listening on port 6000");
});
