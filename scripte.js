/* =========================
   AUTH + FIRESTORE + WEB PUSH (Firebase)
========================= */

/* ---------- Utilitaires UI ---------- */
function isLikelyEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||"").trim()); }
function showAuth(){
  document.getElementById('auth')?.style.setProperty('display','flex');
  document.getElementById('app')?.style.setProperty('display','none');
  document.getElementById('open-signup')?.classList.remove('hidden');
}
function showApp(){
  document.getElementById('auth')?.style.setProperty('display','none');
  document.getElementById('app')?.style.setProperty('display','block');
  document.getElementById('open-signup')?.classList.add('hidden');
}
function friendlyAuthError(e){
  const c=(e&&e.code)||'';
  if(c.includes('invalid-email')) return "Email invalide.";
  if(c.includes('user-disabled')) return "Compte désactivé.";
  if(c.includes('user-not-found')) return "Aucun compte pour cet email.";
  if(c.includes('wrong-password')) return "Mot de passe incorrect.";
  if(c.includes('weak-password')) return "Mot de passe trop court (≥ 6).";
  if(c.includes('email-already-in-use')) return "Email déjà utilisé.";
  if(c.includes('configuration-not-found')) return "Active 'Adresse e-mail/Mot de passe' dans Firebase Authentication.";
  return e.message||"Erreur inconnue.";
}

/* ---------- VAPID public (Web Push) ---------- */
const VAPID_PUBLIC_KEY = "BFSgNk48tjDovjdm0D9tVqKpNj80K9ko-8Ljw4cQDibk1n4tml42EQUywI4L26-GWWB_9UcEporrMRx_-9L1m-0";
function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4 - base64String.length % 4) % 4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64); const output=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) output[i]=raw.charCodeAt(i);
  return output;
}
async function ensurePushSubscription(uid){
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  let perm=Notification.permission;
  if(perm==='default') perm=await Notification.requestPermission();
  if(perm!=='granted') return;

  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub){
    sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const { doc,setDoc,serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
  const id=btoa(sub.endpoint).replace(/=*$/,'');
  await setDoc(doc(window.db,"users",uid,"subscriptions",id), {
    endpoint: sub.endpoint,
    keys: sub.toJSON().keys,
    createdAt: serverTimestamp()
  }, { merge:true });
}

/* =========================
   Bootstrap (connexion / inscription / état)
========================= */
async function bootstrap(){
  if(!window.auth || !window.db) return;

  const errEl      = document.getElementById('auth-error');
  const btnLogin   = document.getElementById('btn-login');
  const btnSignup  = document.getElementById('btn-signup');
  const btnLogout  = document.getElementById('logoutButton');
  const emailIn    = document.getElementById('li-email');
  const passIn     = document.getElementById('li-password');

  const openSignupBtn = document.getElementById('open-signup');
  const signupModal   = document.getElementById('signup-modal');
  const closeSignup   = document.getElementById('close-signup');

  // Ouvrir/fermer la modale
  openSignupBtn?.addEventListener('click', ()=>{
    if(window.auth?.currentUser) return;
    if(!signupModal) return;
    signupModal.style.display='block';
    signupModal.setAttribute('aria-hidden','false');
  });
  closeSignup?.addEventListener('click', ()=>{
    if(!signupModal) return;
    signupModal.style.display='none';
    signupModal.setAttribute('aria-hidden','true');
  });
  window.addEventListener('click', (e)=>{
    if(e.target===signupModal){
      signupModal.style.display='none';
      signupModal.setAttribute('aria-hidden','true');
    }
  });

  // Connexion
  btnLogin?.addEventListener('click', async ()=>{
    const email=(emailIn?.value||'').trim();
    const pass =(passIn?.value||'');
    if(!email||!pass){ if(errEl) errEl.textContent="Remplis l'email et le mot de passe."; return; }
    if(!isLikelyEmail(email)){ if(errEl) errEl.textContent="Saisis un email valide."; return; }
    if(errEl) errEl.textContent='';
    try{
      const { signInWithEmailAndPassword } =
        await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
      await signInWithEmailAndPassword(window.auth,email,pass);
    }catch(e){ if(errEl) errEl.textContent=friendlyAuthError(e); }
  });
  passIn?.addEventListener('keydown', e=>{ if(e.key==='Enter') btnLogin?.click(); });

  // Inscription
  btnSignup?.addEventListener('click', async ()=>{
    const email=(document.getElementById('su-email')?.value||'').trim();
    const pass =(document.getElementById('su-password')?.value||'');
    if(errEl){ errEl.style.color=''; errEl.textContent=''; }
    try{
      if(!isLikelyEmail(email)) throw {code:'auth/invalid-email'};
      if(!pass || pass.length<6) throw {code:'auth/weak-password'};
      const { createUserWithEmailAndPassword, sendEmailVerification, signOut } =
        await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
      const cred=await createUserWithEmailAndPassword(window.auth,email,pass);
      await sendEmailVerification(cred.user);
      await signOut(window.auth);
      if(errEl){
        errEl.style.color='green';
        errEl.textContent="Compte créé ! Vérifie l'email reçu puis reconnecte-toi.";
        setTimeout(()=>{ errEl.style.color=''; }, 4000);
      }
      if(signupModal){
        signupModal.style.display='none';
        signupModal.setAttribute('aria-hidden','true');
      }
    }catch(e){ if(errEl){ errEl.style.color=''; errEl.textContent="Firebase: "+friendlyAuthError(e); } }
  });

  // Déconnexion
  btnLogout?.addEventListener('click', ()=>{
    import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js")
      .then(({signOut})=>signOut(window.auth))
      .catch(console.error);
  });

  // Suivi d'état
  import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js")
    .then(({ onAuthStateChanged, signOut })=>{
      onAuthStateChanged(window.auth, async (user)=>{
        if(user){
          if(!user.emailVerified){
            if(errEl) errEl.textContent="Ton email n’est pas vérifié. Clique sur le lien reçu par email, puis reconnecte-toi.";
            try{ await signOut(window.auth); }catch{}
            showAuth(); openSignupBtn?.classList.remove('hidden'); return;
          }
          currentUid=user.uid;
          showApp();
          openSignupBtn?.classList.add('hidden');
          if(signupModal && signupModal.style.display==='block'){
            signupModal.style.display='none';
            signupModal.setAttribute('aria-hidden','true');
          }

          // Abonnement Web Push
          try{ await ensurePushSubscription(user.uid); }catch(e){ console.warn('Subscription failed', e); }

          await initAppForUser();
        }else{
          currentUid=null; showAuth(); openSignupBtn?.classList.remove('hidden');
        }
      });
    });
}

if(window.auth && window.db){ bootstrap(); }
else{ window.addEventListener('firebase-ready', bootstrap, { once:true }); }

/* =========================
   Firestore (rappels)
========================= */
async function saveReminderForUser(uid,dateISO,note,time,timeUTC,dateUTC){
  const { doc,setDoc,serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
  const ref=doc(window.db,"users",uid,"reminders",dateISO);
  return setDoc(ref,{
    note: note||"",
    time: time||"",
    date: dateISO,
    timeUTC: timeUTC || null,
    dateUTC: dateUTC || null,
    sent: false,
    updatedAt: serverTimestamp()
  },{merge:true});
}
async function getReminderForUser(uid,dateISO){
  const { doc,getDoc } =
    await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
  const ref=doc(window.db,"users",uid,"reminders",dateISO);
  const snap=await getDoc(ref);
  return snap.exists()?snap.data():null;
}

/* =========================
   App calendrier + alarme locale (app ouverte)
========================= */
let selectedDate=null, currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear();
let audioEnabled=false, alarmTriggeredToday=false, reminderTimerId=null, appBound=false, currentUid=null;

/* Bouton "Sauvegarder" — tolère absence d'id */
function getSaveButton(){
  return document.getElementById('saveButton') ||
         document.querySelector('button[onclick="saveCalendarNote()"]');
}

function startApp(){
  audioEnabled=true;
  const btn=document.getElementById('startButton'); if(btn) btn.style.display='none';
  const sound=document.getElementById('alarmSound');
  sound.play().then(()=>{ sound.pause(); sound.currentTime=0; }).catch(()=>{});
}

async function initAppForUser(){
  generateCalendar(currentMonth,currentYear);

  // auto-sélectionne aujourd’hui
  const todayISO = new Date().toISOString().split('T')[0];
  await selectDate(todayISO);

  if(reminderTimerId) clearInterval(reminderTimerId);
  // Vérification toutes les 5 s (fiable & économe)
  reminderTimerId = setInterval(checkRemindersFirestore, 5000);

  if(!appBound){
    document.getElementById("closeAlertBtn")?.addEventListener("click", closeAlert);

    // Quand l’heure change : montrer "Continuer" + réafficher "Sauvegarder"
    document.getElementById("calendar-time")?.addEventListener("input", ()=>{
      const cont = document.getElementById("startButton");
      if(cont) cont.style.display = "block";
      const sb = getSaveButton(); if(sb) sb.style.display = "inline-block";
    });

    appBound=true;
  }
}

function highlightCell(dateISO){
  document.querySelectorAll('#calendar td.selected').forEach(td=>td.classList.remove('selected'));
  const cell=[...document.querySelectorAll('#calendar td')]
    .find(td=>td.getAttribute('onclick')?.includes(dateISO));
  if(cell) cell.classList.add('selected');
}

function generateCalendar(month,year){
  const days=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  let html='<table><tr>';
  for(const d of days) html+=`<th>${d}</th>`;
  html+='</tr><tr>';
  for(let i=0;i<firstDay;i++) html+='<td></td>';
  for(let day=1;day<=daysInMonth;day++){
    const fullDate=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    html+=`<td onclick="selectDate('${fullDate}')">${day}</td>`;
    if((day+firstDay)%7===0) html+='</tr><tr>';
  }
  html+='</tr></table>';
  document.getElementById('calendar').innerHTML=html;
  document.getElementById('month-year').innerText=
    new Date(year,month).toLocaleString('fr-FR',{month:'long'})+' '+year;
}

function changeMonth(offset){
  currentMonth+=offset;
  if(currentMonth<0){ currentMonth=11; currentYear--; }
  else if(currentMonth>11){ currentMonth=0; currentYear++; }
  generateCalendar(currentMonth,currentYear);
  if(selectedDate) highlightCell(selectedDate);
}

async function selectDate(dateISO){
  selectedDate=dateISO;
  document.getElementById('selected-date').innerText=dateISO;
  highlightCell(dateISO);

  if(currentUid){
    const r=await getReminderForUser(currentUid,dateISO);
    document.getElementById('calendar-note').value=r?.note||'';
    document.getElementById('calendar-time').value=r?.time||'';
  }else{
    document.getElementById('calendar-note').value='';
    document.getElementById('calendar-time').value='';
  }

  // Montrer "Continuer", cacher "Sauvegarder" tant qu'on ne modifie rien
  const cont=document.getElementById("startButton"); if(cont) cont.style.display="block";
  const sb=getSaveButton(); if(sb) sb.style.display="none";
}

/* Conversion locale -> UTC (utile côté serveur plus tard) */
function localToUTC(dateISO,timeHM){
  const d=new Date(`${dateISO}T${timeHM}:00`);
  const yyyy=d.getUTCFullYear();
  const mm=String(d.getUTCMonth()+1).padStart(2,'0');
  const dd=String(d.getUTCDate()).padStart(2,'0');
  const HH=String(d.getUTCHours()).padStart(2,'0');
  const MM=String(d.getUTCMinutes()).padStart(2,'0');
  return { dateUTC:`${yyyy}-${mm}-${dd}`, timeUTC:`${HH}:${MM}` };
}

async function saveCalendarNote(){
  if(!selectedDate) return alert('Veuillez sélectionner une date.');
  if(!currentUid)  return alert('Veuillez vous connecter.');

  const note =(document.getElementById('calendar-note')?.value||'').trim();
  const timeEl=document.getElementById('calendar-time');

  let time=(timeEl?.value||'').trim();
  if(!time && timeEl?.getAttribute('value')) time=timeEl.getAttribute('value').trim();

  // Normaliser HH:MM
  if(time && time.includes(':')){
    let [h,m]=time.split(':');
    time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  const msg=document.getElementById('calendar-msg');
  if(!time){
    if(msg){
      msg.style.display='inline';
      msg.style.color='red';
      msg.textContent="Choisis une heure avant d'enregistrer.";
      setTimeout(()=>{ msg.style.display='none'; }, 2000);
    }
    return;
  }

  if(!audioEnabled) startApp();

  const { timeUTC, dateUTC } = localToUTC(selectedDate, time);
  await saveReminderForUser(currentUid,selectedDate,note,time,timeUTC,dateUTC);

  if(msg){
    msg.style.display='inline';
    msg.style.color='green';
    msg.textContent='Rappel sauvegardé !';
    setTimeout(()=>{ msg.style.display='none'; }, 1500);
  }

  // Cacher "Sauvegarder" après succès
  const sb=getSaveButton(); if(sb) sb.style.display="none";
}

/* Vérification périodique avec tolérance de 60 s */
async function checkRemindersFirestore(){
  if(!currentUid || !audioEnabled) return;

  const now=new Date();
  const dateStr=now.toISOString().split('T')[0];
  const nowMs=now.getTime();

  // reset quotidien
  if(window._lastDate!==dateStr){ window._lastDate=dateStr; alarmTriggeredToday=false; }
  if(alarmTriggeredToday) return;

  const r=await getReminderForUser(currentUid,dateStr);
  if(!r || !r.time) return;

  const [hh,mm]=r.time.split(':').map(n=>parseInt(n,10));
  const target=new Date();
  target.setHours(hh,mm,0,0);
  const diff=Math.abs(nowMs - target.getTime()); // ms

  // Tolérance ± 60 secondes
  if(diff<=60000){
    alarmTriggeredToday=true;
    const sound=document.getElementById('alarmSound');
    sound.play().catch(()=>{});
    const stopBtn=document.getElementById('stopButton'); if(stopBtn) stopBtn.style.display='block';
    showAlert(r.note ? ('Rappel : '+r.note) : 'Rappel');
    if(navigator.vibrate) navigator.vibrate(500);
  }
}

function stopAlarm(){
  const sound=document.getElementById('alarmSound');
  if(sound){ sound.pause(); sound.currentTime=0; }
  closeAlert();
  const stopBtn=document.getElementById('stopButton'); if(stopBtn) stopBtn.style.display='none';
}
function showAlert(message){
  const m=document.getElementById('alert-message'); if(m) m.innerText=message;
  const o=document.getElementById('custom-alert'); if(o) o.style.display='flex';
}
function closeAlert(){ const o=document.getElementById('custom-alert'); if(o) o.style.display='none'; }
