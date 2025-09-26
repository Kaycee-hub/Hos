const sqlite3 = require('sqlite3').verbose()
const bcrypt = require('bcrypt')
const db = new sqlite3.Database(process.env.DATABASE_FILE || './data.sqlite')
async function seed(){
  const pwd = await bcrypt.hash('Jajaja606', 10)
  db.serialize(()=>{
    db.run('INSERT OR IGNORE INTO users (id,name,email,password_hash,role,verified) VALUES (?,?,?,?,?,?)', [1,'Billie Highlish','billie@doccheck.com',pwd,'doctor',1])
    db.run('INSERT OR IGNORE INTO patients (id,name,age,email) VALUES (?,?,?,?)', [1,'John Doe',45,'john@example.com'])
    db.run('INSERT OR IGNORE INTO patients (id,name,age,email) VALUES (?,?,?,?)', [2,'Sarah Smith',29,'sarah@example.com'])
    db.run('INSERT OR IGNORE INTO appointments (id,patient,time,date,reason,status) VALUES (?,?,?,?,?,?)', [1,'John Doe','10:00AM','2025-12-10','Checkup','Upcoming'])
    db.run('INSERT OR IGNORE INTO appointments (id,patient,time,date,reason,status) VALUES (?,?,?,?,?,?)', [2,'Sarah Smith','11:30AM','2025-12-11','Follow-up','Upcoming'])
    db.run('INSERT OR IGNORE INTO messages (id,"from",subject,body,read_flag) VALUES (?,?,?,?,?)', [1,'John Doe','Question','Do I need to fast?',0])
    console.log('Seed complete')
  })
  db.close()
}
seed()
