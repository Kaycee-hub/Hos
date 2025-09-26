require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const crypto = require('crypto')

const DB_FILE = process.env.DATABASE_FILE || './data.sqlite'
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_super_secret'
const PORT = process.env.PORT || process.env.PORT || 3000

const db = new sqlite3.Database(DB_FILE)

const app = express()
app.use(cors())
app.use(express.json())

// helper promises
function runAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err)
      resolve(this)
    })
  })
}
function allAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}
function getAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

// mailer setup (GMAIL_USER and GMAIL_PASS must be set in env)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
})

// generate tokens (for email verification and password reset)
function genToken(){ return crypto.randomBytes(24).toString('hex') }

// send verification email (HTML professional)
async function sendVerificationEmail(user, token, origin){
  const verifyUrl = `${origin}/verify/${token}`
  const html = `
  <div style="font-family: Arial, sans-serif; color:#0f172a; padding:20px;">
    <img src="${origin}/logo.png" alt="DocCheck" style="width:120px;"/><h2>Welcome to DocCheck, ${user.name}!</h2>
    <p>Thanks for signing up. Please verify your email by clicking the button below:</p>
    <p><a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">Verify Account</a></p>
    <p style="color:#6b7280;font-size:13px">If you didn't sign up, ignore this message.</p>
  </div>`
  await transporter.sendMail({ from: process.env.GMAIL_USER, to: user.email, subject: 'Verify your DocCheck account', html })
}

// send password reset email
async function sendPasswordResetEmail(user, token, origin){
  const resetUrl = `${origin}/reset-password/${token}`
  const html = `
  <div style="font-family: Arial, sans-serif; color:#0f172a; padding:20px;">
    <img src="${origin}/logo.png" alt="DocCheck" style="width:120px;"/><h2>Password reset request</h2>
    <p>Click the button below to reset your password:</p>
    <p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">Reset Password</a></p>
    <p style="color:#6b7280;font-size:13px">If you didn't request this, you can ignore this message.</p>
  </div>`
  await transporter.sendMail({ from: process.env.GMAIL_USER, to: user.email, subject: 'Reset your DocCheck password', html })
}

// auth routes
app.post('/auth/signup', async (req,res)=>{
  const { name, email, password, role } = req.body
  if(!name || !email || !password) return res.status(400).json({ error:'Missing' })
  try{
    const hash = await bcrypt.hash(password, 10)
    const r = await runAsync('INSERT INTO users (name,email,password_hash,role,verified,verify_token) VALUES (?,?,?,?,?,?)', [name,email,hash,role||'staff',0, genToken()])
    const user = await getAsync('SELECT id,name,email,role,verified,verify_token FROM users WHERE id = ?', [r.lastID])
    // send verification email (origin header or env BASE_URL)
    const origin = req.headers.origin || process.env.BASE_URL || ('http://localhost:'+PORT)
    await sendVerificationEmail(user, user.verify_token, origin)
    res.json({ ok:true })
  }catch(e){ console.error(e); res.status(500).json({ error:'Signup failed' }) }
})

app.get('/verify/:token', async (req,res)=>{
  const token = req.params.token
  const user = await getAsync('SELECT * FROM users WHERE verify_token = ?', [token])
  if(!user) return res.status(400).send('Invalid token')
  await runAsync('UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?', [user.id])
  res.sendFile(path.join(__dirname,'public','verify-success.html'))
})

app.post('/auth/login', async (req,res)=>{
  const { email, password } = req.body
  if(!email || !password) return res.status(400).json({ error:'Missing' })
  try{
    const user = await getAsync('SELECT * FROM users WHERE email = ?', [email])
    if(!user) return res.status(401).json({ error:'Invalid credentials' })
    if(!user.verified) return res.status(403).json({ error:'Email not verified' })
    const match = await bcrypt.compare(password, user.password_hash)
    if(!match) return res.status(401).json({ error:'Invalid credentials' })
    const token = jwt.sign({ id:user.id, name:user.name, email:user.email, role:user.role }, JWT_SECRET, { expiresIn:'8h' })
    res.json({ token, user:{ id:user.id, name:user.name, email:user.email, role:user.role } })
  }catch(e){ console.error(e); res.status(500).json({ error:'Login failed' }) }
})

// password reset request
app.post('/auth/forgot', async (req,res)=>{
  const { email } = req.body
  if(!email) return res.status(400).json({ error:'Missing' })
  const user = await getAsync('SELECT * FROM users WHERE email = ?', [email])
  if(!user) return res.status(200).json({ ok:true }) // don't reveal existence
  const token = genToken()
  await runAsync('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', [token, Date.now()+3600*1000, user.id])
  const origin = req.headers.origin || process.env.BASE_URL || ('http://localhost:'+PORT)
  await sendPasswordResetEmail(user, token, origin)
  res.json({ ok:true })
})

// perform password reset
app.post('/auth/reset/:token', async (req,res)=>{
  const token = req.params.token; const { password } = req.body
  const user = await getAsync('SELECT * FROM users WHERE reset_token = ?', [token])
  if(!user || user.reset_expires < Date.now()) return res.status(400).json({ error:'Invalid or expired token' })
  const hash = await bcrypt.hash(password, 10)
  await runAsync('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?', [hash, user.id])
  res.json({ ok:true })
})

// middleware to protect routes
function authMiddleware(req,res,next){
  const auth = req.headers.authorization
  if(!auth) return res.status(401).json({ error:'Missing token' })
  const parts = auth.split(' ')
  if(parts.length!==2) return res.status(401).json({ error:'Invalid token' })
  try{
    const payload = jwt.verify(parts[1], JWT_SECRET)
    req.user = payload; next()
  }catch(e){ return res.status(401).json({ error:'Invalid token' }) }
}

// appointments endpoints
app.get('/appointments', authMiddleware, async (req,res)=>{
  const rows = await allAsync('SELECT * FROM appointments ORDER BY id DESC'); res.json(rows)
})
app.post('/appointments', authMiddleware, async (req,res)=>{
  const { patient, time, date, reason } = req.body
  const r = await runAsync('INSERT INTO appointments (patient,time,date,reason,status) VALUES (?,?,?,?,?)', [patient,time,date,reason,'Upcoming'])
  const created = await getAsync('SELECT * FROM appointments WHERE id = ?', [r.lastID])
  res.json(created)
})
app.put('/appointments/:id', authMiddleware, async (req,res)=>{
  const id = req.params.id; const { status } = req.body; await runAsync('UPDATE appointments SET status = ? WHERE id = ?', [status,id]); const row = await getAsync('SELECT * FROM appointments WHERE id = ?', [id]); res.json(row)
})
app.delete('/appointments/:id', authMiddleware, async (req,res)=>{ const id=req.params.id; await runAsync('DELETE FROM appointments WHERE id = ?', [id]); res.json({ ok:true }) })

// patients
app.get('/patients', authMiddleware, async (req,res)=>{ const rows = await allAsync('SELECT * FROM patients ORDER BY id DESC'); res.json(rows) })
app.post('/patients', authMiddleware, async (req,res)=>{ const { name, age, email } = req.body; const r = await runAsync('INSERT INTO patients (name,age,email) VALUES (?,?,?)', [name,age,email]); const row = await getAsync('SELECT * FROM patients WHERE id = ?', [r.lastID]); res.json(row) })

// messages
app.get('/messages', authMiddleware, async (req,res)=>{ const rows = await allAsync('SELECT * FROM messages ORDER BY id DESC'); res.json(rows) })
app.post('/messages', authMiddleware, async (req,res)=>{ const { from, subject, body } = req.body; const r = await runAsync('INSERT INTO messages ("from",subject,body,read_flag) VALUES (?,?,?,?)', [from,subject,body,0]); const row = await getAsync('SELECT * FROM messages WHERE id = ?', [r.lastID]); res.json(row) })

// users (admin)
app.get('/users', authMiddleware, async (req,res)=>{ const rows = await allAsync('SELECT id,name,email,role,verified FROM users ORDER BY id DESC'); res.json(rows) })

// reset DB (admin only) - clears demo tables and reseeds demo data but preserves admin
app.post('/admin/reset-db', authMiddleware, async (req,res)=>{
  try{
    // check admin role
    const u = await getAsync('SELECT * FROM users WHERE id = ?', [req.user.id])
    if(!u || u.role !== 'doctor') return res.status(403).json({ error:'Forbidden' })
    // delete demo data
    await runAsync('DELETE FROM appointments')
    await runAsync('DELETE FROM patients')
    await runAsync('DELETE FROM messages')
    // reseed demo data
    await runAsync('INSERT INTO patients (name,age,email) VALUES (?,?,?)', ['John Doe',45,'john@example.com'])
    await runAsync('INSERT INTO patients (name,age,email) VALUES (?,?,?)', ['Sarah Smith',29,'sarah@example.com'])
    await runAsync('INSERT INTO appointments (patient,time,date,reason,status) VALUES (?,?,?,?,?)', ['John Doe','10:00AM','2025-12-10','Checkup','Upcoming'])
    await runAsync('INSERT INTO appointments (patient,time,date,reason,status) VALUES (?,?,?,?,?)', ['Sarah Smith','11:30AM','2025-12-11','Follow-up','Upcoming'])
    await runAsync('INSERT INTO messages ("from",subject,body,read_flag) VALUES (?,?,?,?)', ['John Doe','Question','Do I need to fast?','0'])
    res.json({ ok:true })
  }catch(e){ console.error(e); res.status(500).json({ error:'Reset failed' }) }
})

// serve static frontend
app.use(express.static(path.join(__dirname,'public')))
app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')) )

app.listen(PORT, ()=> console.log('Server listening on', PORT))
