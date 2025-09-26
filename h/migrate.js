const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(process.env.DATABASE_FILE || './data.sqlite')
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT UNIQUE, password_hash TEXT, role TEXT, verified INTEGER DEFAULT 0, verify_token TEXT, reset_token TEXT, reset_expires INTEGER
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, patient TEXT, time TEXT, date TEXT, reason TEXT, status TEXT
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER, email TEXT
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, "from" TEXT, subject TEXT, body TEXT, read_flag INTEGER DEFAULT 0
  )`)
  console.log('Migrations complete'); db.close()
})
