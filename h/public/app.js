(async function(){
  const PAGES = document.querySelectorAll('.page')
  const navBtns = document.querySelectorAll('.nav-btn')
  const pageTitle = document.getElementById('pageTitle')
  function showPage(name){ PAGES.forEach(p => p.id === name ? p.classList.add('active') : p.classList.remove('active')); navBtns.forEach(b => b.dataset.page === name ? b.classList.add('active') : b.classList.remove('active')); pageTitle.textContent = name.charAt(0).toUpperCase() + name.slice(1) }
  navBtns.forEach(b => b.addEventListener('click', ()=> showPage(b.dataset.page)))

  function authHeaders(){ const t = localStorage.getItem('doc_token'); return t ? {'Authorization':'Bearer '+t,'Content-Type':'application/json'} : {'Content-Type':'application/json'} }

  async function api(path, opts={}){ const res = await fetch(path, opts); if(res.status===401) { alert('Session expired'); localStorage.removeItem('doc_token'); location.reload(); throw 'unauth' } return res.json() }

  async function renderAll(){ try{ const appts = await fetch('/appointments',{headers: authHeaders()}).then(r=>r.json()); const patients = await fetch('/patients',{headers: authHeaders()}).then(r=>r.json()); const messages = await fetch('/messages',{headers: authHeaders()}).then(r=>r.json()); document.getElementById('statAppointments').textContent = appts.length; document.getElementById('statPatients').textContent = patients.length; document.getElementById('statPresc').textContent = 174; const tbody = document.querySelector('#appointmentsTable tbody'); tbody.innerHTML=''; appts.forEach(a=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${a.patient}</td><td>${a.time}</td><td>${a.date}</td><td>${a.reason}</td><td><span>${a.status}</span> <button class='tog' data-id='${a.id}'>toggle</button> <button class='del' data-id='${a.id}'>delete</button></td>`; tbody.appendChild(tr) }); document.querySelectorAll('.tog').forEach(btn=>btn.addEventListener('click', async e=>{ const id=e.target.dataset.id; const current = appts.find(x=>x.id==id); await fetch('/appointments/'+id,{method:'PUT',headers:authHeaders(),body: JSON.stringify({status: current.status==='Upcoming'?'Completed':'Upcoming'})}); init() })); document.querySelectorAll('.del').forEach(btn=>btn.addEventListener('click', async e=>{ const id=e.target.dataset.id; await fetch('/appointments/'+id,{method:'DELETE',headers:authHeaders()}); init() })); const tbody2 = document.querySelector('#appointmentsTableAll tbody'); tbody2.innerHTML=''; appts.forEach(a=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${a.patient}</td><td>${a.time}</td><td>${a.date}</td><td>${a.reason}</td><td>${a.status}</td>`; tbody2.appendChild(tr) }); const pEl = document.getElementById('patientsList'); pEl.innerHTML=''; patients.forEach(p=>{ const d=document.createElement('div'); d.textContent = p.name+' — '+p.email; pEl.appendChild(d) }); const mEl = document.getElementById('messagesList'); mEl.innerHTML=''; messages.forEach(m=>{ const d=document.createElement('div'); d.innerHTML='<strong>'+m.from+'</strong>: '+m.subject; mEl.appendChild(d) }); drawChart() }catch(e){ if(e==='unauth') return; console.error(e) } }

  // login flow using email
  async function showLogin(){
    const email = prompt('Email (billie@doccheck.com)')
    const password = prompt('Password (Jajaja606)')
    try{
      const res = await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({email,password})})
      const data = await res.json()
      if(!res.ok){ alert(data.error||'Login failed'); return showLogin() }
      localStorage.setItem('doc_token', data.token); localStorage.setItem('doc_user', data.user.name); document.getElementById('userName').textContent = data.user.name; document.getElementById('userRole').textContent = data.user.role; init(); return
    }catch(e){ alert('Login error'); console.error(e); }
  }

  // signup
  const signupForm = document.getElementById('signupForm')
  signupForm.addEventListener('submit', async (e)=>{ e.preventDefault(); const fd=new FormData(signupForm); const body={ name: fd.get('name'), email: fd.get('email'), password: fd.get('password'), role: fd.get('role') }; const res = await fetch('/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify(body)}); if(!res.ok){ const t=await res.json(); alert(t.error||'Error'); return } alert('Check your email for verification link'); showPage('dashboard') })

  // forgot password form
  const forgotForm = document.getElementById('forgotForm'); forgotForm.addEventListener('submit', async (e)=>{ e.preventDefault(); const fd=new FormData(forgotForm); const email = fd.get('email'); await fetch('/auth/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({email})}); alert('If that email exists we sent a reset link'); showPage('dashboard') })

  // modal and create appt
  const modal = document.getElementById('modal'), createBtn = document.getElementById('createBtn'), cancelBtn = document.getElementById('cancelBtn'), apptForm = document.getElementById('apptForm')
  createBtn.addEventListener('click', ()=> modal.classList.remove('hidden'))
  cancelBtn.addEventListener('click', ()=> modal.classList.add('hidden'))
  apptForm.addEventListener('submit', async (e)=>{ e.preventDefault(); const fd=new FormData(apptForm); const newAppt = { patient: fd.get('patient'), time: fd.get('time')||'9:00AM', date: fd.get('date')||new Date().toISOString().slice(0,10), reason: fd.get('reason')||'Checkup' }; await fetch('/appointments',{method:'POST',headers:authHeaders(),body: JSON.stringify(newAppt)}); modal.classList.add('hidden'); apptForm.reset(); init(); })

  // reset DB button visible to admin via API call
  async function resetDb(){ if(!confirm('Reset demo data?')) return; const res = await fetch('/admin/reset-db',{method:'POST',headers:authHeaders()}); if(res.ok) alert('DB reset'); init() }
  // attach reset to settings card
  const settingsCard = document.getElementById('settingsCard'); const btn = document.createElement('button'); btn.textContent='Reset Demo DB'; btn.className='primary'; btn.style.marginTop='8px'; btn.addEventListener('click', resetDb); settingsCard.appendChild(btn)

  function drawChart(){ const canvas=document.getElementById('chartCanvas'); if(!canvas) return; const ctx=canvas.getContext('2d'); const data=[700,1500,4940,1200,3400,2800,3100]; const w=canvas.width,h=canvas.height,pad=30; ctx.clearRect(0,0,w,h); const max=Math.max(...data),min=Math.min(...data); const xs=(w-2*pad)/(data.length-1); ctx.fillStyle='rgba(96,165,250,0.2)'; ctx.beginPath(); data.forEach((v,i)=>{ const x=pad+i*xs; const y=pad+(h-2*pad)*(1-(v-min)/(max-min)); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y) }); ctx.lineTo(w-pad,h-pad); ctx.lineTo(pad,h-pad); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.strokeStyle='#2563eb'; ctx.lineWidth=2; data.forEach((v,i)=>{ const x=pad+i*xs; const y=pad+(h-2*pad)*(1-(v-min)/(max-min)); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y) }); ctx.stroke() }

  async function init(){ if(!localStorage.getItem('doc_token')) { await showLogin(); } document.getElementById('userName').textContent = localStorage.getItem('doc_user') || 'User'; try{ await renderAll() }catch(e){console.error(e)} }
  window.addEventListener('load', ()=>{ init() })
  document.getElementById('logoutBtn').addEventListener('click', ()=>{ localStorage.removeItem('doc_token'); localStorage.removeItem('doc_user'); alert('Logged out'); showLogin(); })
})()
