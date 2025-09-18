/* =========================
   AUTH + FIRESTORE (Firebase)
========================= */

function isLikelyEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||"").trim()); }
function showAuth(){
  const a=document.getElementById('auth'); if(a)a.style.display='flex';
  const b=document.getElementById('app');  if(b)b.style.display='none';
  document.getElementById('open-signup')?.classList.remove('hidden');
}
function showApp(){
  const a=document.getElementById('auth'); if(a)a.style.display='none';
  const b=document.getElementById('app');  if(b)b.style.display='block';
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

async function bootstrap(){
  if(!window.auth || !window.db) return;

  const errEl      = document.getElementById('auth-error');
  const btnLogin   = document.getElementById('btn-login');
  const btnSignup  = document.getElementById('btn-signup');
  const btnLogout  = document.getElementById('logoutButton');
  const emailIn    = document.getElementById('li-email');
  const passIn     = document.getElementById('li-password');
  const suEmailIn  = document.getElementById('su-email');
  const suPassIn   = document.getElementById('su-password');

  const setBusy = (el, busy, txtIdle, txtBusy) => {
    if(!el) return;
    if(txtIdle && !el.dataset._idle) el.dataset._idle = txtIdle;
    el.disabled = !!busy;
    el.textContent = busy ? (txtBusy||el.textContent) : (el.dataset._idle||el.textContent);
  };

  // Connexion
  btnLogin?.addEventListener('click', async () => {
    const email=(emailIn?.value||'').trim();
    const pass =(passIn?.value||'');
    if(!email||!pass){ errEl.textContent="Remplis l'email et le mot de passe."; return; }
    if(!isLikelyEmail(email)){ errEl.textContent="Saisis un email valide (ex. nom@domaine.com)."; return; }
    errEl.textContent='';
    setBusy(btnLogin,true,"Se connecter","Connexion…");
    try{
      const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
      await signInWithEmailAndPassword(window.auth,email,pass);
    }catch(e){ errEl.textContent=friendlyAuthError(e); }
    finally{ setBusy(btnLogin,false,"Se connecter"); }
  });
  passIn?.addEventListener('keydown', e=>{ if(e.key==='Enter') btnLogin?.click(); });

  // Création de compte
  btnSignup?.addEventListener('click', async ()=>{
    const email=(suEmailIn?.value||'').trim();
    const pass =(suPassIn?.value||'');
    errEl.style.color=''; errEl.textContent='';
    setBusy(btnSignup,true,"Créer un compte","Création…");
    try{
      if(!isLikelyEmail(email)) throw {code:'auth/invalid-email'};
      if(!pass || pass.length<6) throw {code:'auth/weak-password'};
      const { createUserWithEmailAndPassword, sendEmailVerification, signOut } =
        await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
      const cred = await createUserWithEmailAndPassword(window.auth,email,pass);
      await sendEmailVerification(cred.user);
      await signOut(window.auth);
      errEl.style.color='green';
      errEl.textContent="Compte créé ! Vérifie l'email reçu puis reconnecte-toi.";
      const modal = document.getElementById('signup-modal');
      if(modal){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); }
    }catch(e){ errEl.style.color=''; errEl.textContent="Firebase: "+friendlyAuthError(e); }
    finally{ setBusy(btnSignup,false,"Créer un compte"); }
  });

  // Déconnexion
  btnLogout?.addEventListener('click', ()=>{
    import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js")
      .then(({signOut})=>signOut(window.auth))
      .catch(console.error);
  });

  // État d'auth
  import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js")
    .then(({ onAuthStateChanged, signOut })=>{
      onAuthStateChanged(window.auth, async (user)=>{
        if(user){
          if(!user.emailVerified){
            try{ await signOut(window.auth); }catch{}
            errEl.textContent="Ton email n’est pas vérifié. Clique sur le lien reçu par email, puis reconnecte-toi.";
            showAuth(); return;
          }
          currentUid=user.uid;
          showApp();
          await initAppForUser(user.uid);
        }else{
          currentUid=null; showAuth();
        }
      });
    });
}

if(window.auth && window.db){ bootstrap(); }
else{ window.addEventListener('firebase-ready', bootstrap, { once:true }); }

/* =========================
   Firestore (rappels)
========================= */
async function saveReminderForUser(uid,dateISO,note,time){
  const { doc,setDoc,serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
  const ref=doc(window.db,"users",uid,"reminders",dateISO);
  return setDoc(ref,{note:note||"",time:time||"",updatedAt:serverTimestamp()},{merge:true});
}
async function getReminderForUser(uid,dateISO){
  const { doc,getDoc } =
    await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
  const ref=doc(window.db,"users",uid,"reminders",dateISO);
  const snap=await getDoc(ref);
  return snap.exists()?snap.data():null;
}

/* =========================
   Application calendrier
========================= */
let selectedDate=null, currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear();
let audioEnabled=false, alarmTriggeredToday=false, reminderTimerId=null, appBound=false, currentUid=null;

function startApp(){
  audioEnabled=true;
  const btn=document.getElementById('startButton'); if(btn) btn.style.display='none';
  const sound=document.getElementById('alarmSound');
  sound.play().then(()=>{ sound.pause(); sound.currentTime=0; })
    .catch(()=>{/* OK, on réessaiera au déclenchement */});
}

async function initAppForUser(uid){
  generateCalendar(currentMonth,currentYear);

  // Auto-sélectionne aujourd’hui
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  await selectDate(todayISO);

  if(reminderTimerId) clearInterval(reminderTimerId);
  reminderTimerId=setInterval(checkRemindersFirestore,1000);

  if(!appBound){
    document.getElementById("closeAlertBtn")?.addEventListener("click",closeAlert);

    // Afficher “Continuer” dès qu’une heure est saisie
    const timeEl = document.getElementById("calendar-time");
    timeEl?.addEventListener("input",()=>{
      const sb=document.getElementById("startButton"); if(sb) sb.style.display="block";
    });
    timeEl?.addEventListener("change",()=>{
      const sb=document.getElementById("startButton"); if(sb) sb.style.display="block";
    });

    appBound=true;
  }
}

/* Surbrillance cellule */
function highlightCell(dateISO){
  document.querySelectorAll('#calendar td.selected').forEach(td => td.classList.remove('selected'));
  const cell = Array.from(document.querySelectorAll('#calendar td'))
    .find(td => td.getAttribute('onclick')?.includes(dateISO));
  if(cell) cell.classList.add('selected');
}

function generateCalendar(month,year){
  const days=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  let html='<table><tr>';
  for(let d of days) html+='<th>'+d+'</th>';
  html+='</tr><tr>';
  for(let i=0;i<firstDay;i++) html+='<td></td>';
  for(let day=1;day<=daysInMonth;day++){
    const fullDate=`${year}-${(month+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
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

async function selectDate(date){
  selectedDate=date;
  document.getElementById('selected-date').innerText=date;

  highlightCell(date);
  const sb=document.getElementById("startButton"); if(sb) sb.style.display="block";

  if(currentUid){
    const r=await getReminderForUser(currentUid,date);
    document.getElementById('calendar-note').value=r?.note||'';
    document.getElementById('calendar-time').value=r?.time||'';
  }else{
    document.getElementById('calendar-note').value='';
    document.getElementById('calendar-time').value='';
  }
}

async function saveCalendarNote(){
  const msg=document.getElementById('calendar-msg');
  if(!currentUid){ alert('Veuillez vous connecter.'); return; }
  if(!selectedDate){ alert('Veuillez sélectionner une date.'); return; }

  const note=(document.getElementById('calendar-note')?.value||'').trim();
  const timeEl=document.getElementById('calendar-time');

  // Récupération robuste de l’heure sur mobile
  let time=(timeEl?.value||'').trim();
  if(!time && timeEl?.getAttribute('value')) time=timeEl.getAttribute('value').trim();

  if(!time){
    if(msg){
      msg.style.display='inline'; msg.style.color='red';
      msg.textContent="Choisis une heure avant d'enregistrer.";
      setTimeout(()=>{ msg.style.display='none'; msg.style.color='green'; msg.textContent='Rappel sauvegardé !'; }, 2000);
    }
    return;
  }

  // Déverrouille l’audio si l’utilisateur a oublié d’appuyer sur “Continuer”
  if(!audioEnabled){ startApp(); }

  try{
    console.log('[save] uid=', currentUid, 'date=', selectedDate, 'time=', time, 'note=', note);
    await saveReminderForUser(currentUid,selectedDate,note,time);
    if(msg){
      msg.style.display='inline'; msg.style.color='green';
      msg.textContent='Rappel sauvegardé !';
      setTimeout(()=>{ msg.style.display='none'; }, 2000);
    }
  }catch(e){
    console.error('Erreur Firestore saveReminderForUser:', e);
    if(msg){
      msg.style.display='inline'; msg.style.color='red';
      msg.textContent="Erreur d’enregistrement: "+(e.message||'inconnue');
      setTimeout(()=>{ msg.style.display='none'; msg.style.color='green'; msg.textContent='Rappel sauvegardé !'; }, 3000);
    }else{
      alert("Erreur d’enregistrement: "+(e.message||'inconnue'));
    }
  }
}

async function checkRemindersFirestore(){
  if(!currentUid||!audioEnabled||alarmTriggeredToday) return;
  const now=new Date();
  const dateStr=now.toISOString().split('T')[0];
  const timeStr=now.toTimeString().slice(0,5);
  const r=await getReminderForUser(currentUid,dateStr);

  // Sonner même si la note est vide
  if(r && r.time===timeStr){
    alarmTriggeredToday=true;
    const sound=document.getElementById('alarmSound');
    sound.play().catch(()=>{});
    document.getElementById('stopButton').style.display='block';
    showAlert('Rappel' + (r.note ? ' : '+r.note : ''));
    if(navigator.vibrate) navigator.vibrate(500);
  }
}

function stopAlarm(){
  const sound=document.getElementById('alarmSound');
  sound.pause(); sound.currentTime=0; closeAlert();
  document.getElementById('stopButton').style.display='none';
}
function showAlert(message){
  document.getElementById('alert-message').innerText=message;
  document.getElementById('custom-alert').style.display='flex';
}
function closeAlert(){ document.getElementById('custom-alert').style.display='none'; }
