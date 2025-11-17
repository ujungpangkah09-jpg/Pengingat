// app.js - PWA version with nightly prepare (20:00 default), soft alarm sound, PR storage
const SCHEDULE_FILE = 'schedule.json';
const STORAGE_KEYS = {PRS: 'pengingat_prs', ALARMS_ENABLED: 'pengingat_alarms_enabled'};
let weeklySchedule = {};
let scheduledTimeouts = [];
let alarmsEnabled = false;
const DEFAULT_PREP = '20:00'; // default prepare time

async function loadSchedule(){ try{ const res = await fetch(SCHEDULE_FILE); if(!res.ok) throw new Error('fetch failed'); weeklySchedule = await res.json(); }catch(e){ console.warn('schedule.json load failed', e); weeklySchedule = {}; } }

function renderSchedule(){ const container = document.getElementById('schedule-list'); container.innerHTML=''; Object.keys(weeklySchedule).forEach(day=>{ const d = document.createElement('div'); d.className='schedule-day'; d.innerHTML = `<strong>${day}</strong> — ${weeklySchedule[day].length} sesi`; weeklySchedule[day].forEach(slot=>{ const s = document.createElement('div'); s.className='slot'; s.innerHTML = `<div>${slot.start} — ${slot.end} • <strong>${slot.subject}</strong> • ${slot.teacher} • R:${slot.room||'-'}</div>`; d.appendChild(s); }); container.appendChild(d); }); }

// PR management
function loadPRs(){ try{ const raw = localStorage.getItem(STORAGE_KEYS.PRS); return raw ? JSON.parse(raw) : []; }catch(e){ return []; } }
function savePRs(prs){ localStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(prs)); }
function renderPRs(){ const list = document.getElementById('pr-list'); const prs = loadPRs(); list.innerHTML=''; if(prs.length===0){ list.innerHTML='<div class=\"muted\">Belum ada PR.</div>'; return; } prs.forEach((p,i)=>{ const div = document.createElement('div'); div.className='pr-item'; div.innerHTML = `<div><strong>${p.subject}</strong> ${p.due?'<span class=\"muted\">('+p.due+')</span>':''}<div class=\"muted\">${p.desc||''}</div></div><div><button class=\"btn\" onclick=\"togglePR(${i})\">${p.done?'✅ Selesai':'⭕ Belum'}</button> <button class=\"btn\" onclick=\"deletePR(${i})\">🗑️</button></div>`; list.appendChild(div); }); }
function addPR(obj){ const prs = loadPRs(); prs.push(obj); savePRs(prs); renderPRs(); }
function togglePR(i){ const prs = loadPRs(); prs[i].done = !prs[i].done; savePRs(prs); renderPRs(); }
function deletePR(i){ const prs = loadPRs(); prs.splice(i,1); savePRs(prs); renderPRs(); }

// Utilities
function parseHM(hm){ const [h,m]=hm.split(':').map(x=>parseInt(x,10)); return {h,m}; }
function dayNameToIndex(name){ const map={'Minggu':0,'Senin':1,'Selasa':2,'Rabu':3,'Kamis':4,'Jumat':5,'Sabtu':6}; return map[name]; }
function nextOccurrence(dayName,timeHM,withinDays=7){ const now=new Date(); const target=dayNameToIndex(dayName); if(target===undefined) return null; const {h,m}=parseHM(timeHM); for(let i=0;i<=withinDays;i++){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i); if(d.getDay()===target){ d.setHours(h,m,0,0); if(d.getTime()>=Date.now()) return d; } } return null; }

async function requestNotificationPermission(){ if(!('Notification' in window)) return false; if(Notification.permission==='granted') return true; if(Notification.permission!=='denied'){ const p = await Notification.requestPermission(); return p==='granted'; } return false; }

function playSound(){ const audio = document.getElementById('alarm-sound'); if(!audio) return; try{ audio.currentTime = 0; audio.play(); }catch(e){} }
function notify(title, body){ if(Notification.permission==='granted') new Notification(title,{body}); else alert(title + '\n' + body); }

// Nightly prepare & PR reminders
function clearScheduledTimeouts(){ scheduledTimeouts.forEach(id=>clearTimeout(id)); scheduledTimeouts=[]; }

function getSubjectsForTomorrow(){ const now = new Date(); const t = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1); const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']; const dayName = days[t.getDay()]; return weeklySchedule[dayName] ? weeklySchedule[dayName].map(s=>s.subject) : []; }

function getPRsForSubjects(subjects){ const prs = loadPRs(); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); const tom = tomorrow.toISOString().split('T')[0]; return prs.filter(p=>!p.done && ((p.due && p.due===tom) || subjects.includes(p.subject))); }

function handleNightlyPrepare(){ const subs = Array.from(new Set(getSubjectsForTomorrow())); const subjText = subs.length ? subs.join(', ') : 'Tidak ada pelajaran besok'; const prs = getPRsForSubjects(subs); const prText = prs.length ? prs.map(p=>`${p.subject}: ${p.desc||'(tanpa deskripsi)'}`).join('\\n') : 'Tidak ada PR penting untuk besok'; const title = `Siapkan buku untuk besok`; const body = `Pelajaran besok: ${subjText}\\nPR terkait:\\n${prText}`; playSound(); notify(title, body); console.log('Nightly prepare:', body); }

// schedule nightly prepare for next 7 days at given timeHM
async function scheduleNightlyPrepare(timeHM){ clearScheduledTimeouts(); const ok = await requestNotificationPermission(); const now = Date.now(); for(let i=0;i<7;i++){ const d = new Date(); d.setDate(d.getDate()+i); const {h,m} = parseHM(timeHM); d.setHours(h,m,0,0); if(d.getTime()<=now) continue; const diff = d.getTime()-now; const id = setTimeout(()=>{ handleNightlyPrepare(); const refreshId = setTimeout(()=> scheduleNightlyPrepare(timeHM), 60*1000); scheduledTimeouts.push(refreshId); }, diff); scheduledTimeouts.push(id); } }

// UI wiring
document.addEventListener('DOMContentLoaded', async ()=>{ document.getElementById('enable-alarms').addEventListener('click', async ()=>{ const time = document.getElementById('prepare-time').value || DEFAULT_PREP; if(!alarmsEnabled){ const ok = await requestNotificationPermission(); if(!ok) alert('Izinkan notifikasi agar pengingat muncul.'); await scheduleNightlyPrepare(time); alarmsEnabled = true; localStorage.setItem(STORAGE_KEYS.ALARMS_ENABLED,'true'); document.getElementById('enable-alarms').textContent = '🔕 Nonaktifkan Pengingat Malam'; alert('Pengingat malam diaktifkan. Pastikan tab terbuka atau install PWA.'); } else { clearScheduledTimeouts(); alarmsEnabled = false; localStorage.setItem(STORAGE_KEYS.ALARMS_ENABLED,'false'); document.getElementById('enable-alarms').textContent = 'Aktifkan Pengingat Malam'; } }); document.getElementById('disable-alarms').addEventListener('click', ()=>{ clearScheduledTimeouts(); alarmsEnabled=false; localStorage.setItem(STORAGE_KEYS.ALARMS_ENABLED,'false'); document.getElementById('enable-alarms').textContent='Aktifkan Pengingat Malam'; }); document.getElementById('pr-form').addEventListener('submit',(e)=>{ e.preventDefault(); const subject = document.getElementById('pr-subject').value.trim(); const desc = document.getElementById('pr-desc').value.trim(); const due = document.getElementById('pr-due').value || null; if(!subject) return alert('Isi mata pelajaran untuk PR.'); addPR({subject,desc,due,done:false,createdAt:new Date().toISOString()}); document.getElementById('pr-form').reset(); }); document.getElementById('export-json')?.addEventListener('click', ()=>{ downloadFile('jadwal_sekolah.json', JSON.stringify(weeklySchedule,null,2),'application/json'); }); document.getElementById('export-csv')?.addEventListener('click', ()=>{ let csv='Hari,Mulai,Selesai,Mapel,Guru,Ruang\\n'; for(const day in weeklySchedule){ weeklySchedule[day].forEach(slot=>{ csv += `${day},${slot.start},${slot.end},\"${slot.subject}\",\"${slot.teacher}\",${slot.room}\\n`; }); } downloadFile('jadwal_sekolah.csv', csv, 'text/csv'); }); await loadSchedule(); renderSchedule(); renderPRs(); }); function downloadFile(filename,content,type='application/octet-stream'){ const blob = new Blob([content],{type}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }