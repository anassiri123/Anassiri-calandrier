/* =========================
   AUTH + FIRESTORE (Firebase)
   - signup avec email de vérification
   - login bloqué si email non vérifié
   - rappels Firestore: users/{uid}/reminders/{dateISO}
========================= */

// ---- utils UI
function isLikelyEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||"").trim()); }
function showAuth(){ const a=document.getElementById('auth'); if(a)a.style.display='flex'; const b=document.getElementById('app'); if(b)b.style.display='none'; }
function showApp(){ const a=document.getElementById('auth'); if(a)a.style.display='none'; const b=document.getElementById('app'); if(b)b.style.display='block'; }
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

/* =========================
   Bootstrap quand Firebase est prêt
========================= */
async function bootstrap(){
  if(!window.auth || !window.db) return; // sécurité

  // --- références DOM
  const errEl     = document.getElementById('auth-error');
  const btnLogin  = document.getElementById('btn-login');
  const btnSignup = document.getElementById('btn-signup');
  const btnLogout = document.getElementById('logoutButton');
  const emailIn   = document.getElementById('li-email');
  const passIn    = document.getElementById('li-password');

  // Modale / bouton "Créer un compte"
  const openSignupBtn = document.getElementById('open-signup');
  const signupModal   = document.getElementById('signup-modal');
  const closeSignup   = document.getElementById('close-signup');

  // -- Ouverture/fermeture modale côté JS (utile si le HTML ne le fait pas)
  openSignupBtn?.addEventListener('click', () => {
    if (window.auth?.currentUser) return;           // déjà connecté → ne rien faire
    if (!signupModal) return;
    signupModal.style.display = 'block';
    signupModal.setAttribute('aria-hidden','false');
  });
  closeSignup?.addEventListener('click', () => {
    if (!signupModal) return;
    signupModal.style.display = 'none';
    signupModal.setAttribute('aria-hidden','true');
  });
  window.addEventListener('click', (e) => {
    if (e.target === signupModal) {
      signupModal.style.display = 'none';
      signupModal.setAttribute('aria-hidden','true');
    }
  });

  // --- Connexion
  btnLogin?.addEventListener('click', async () => {
    const email=(emailIn?.value||'').trim();
    const pass =(passIn?.value||'');
    if(!email||!pass){ errEl.textContent="Remplis l'email et le mot de passe."; return; }
    if(!isLikelyEmail(email)){ errEl.textContent="Saisis un email valide (ex. nom@domaine.com)."; return; }
    errEl.textContent='';
    try{
      const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js");
      await signInWithEmailAndPassword(window.auth,email,pass);
    }catch(e){ errEl.textContent=friendlyAuthError(e); }
  });
  passIn?.addEventListener('keydown', e=>{ if(e.key==='Enter') btnLogin?.click(); });

  // --- Création de compte (avec vérification email)
  btnSignup?.addEventListener('click', async ()=>{
    const email=(document.getElementById('su-email')?.value||'').trim();
    const pass =(document.getElementById('su-password')?.value||'');
    errEl.textContent='';
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
      setTimeout(()=>{ errEl.style.color=''; }, 4000);
    }catch(e){ errEl.style.color=''; errEl.textContent="Firebase: "+friendlyAuthError(e); }
  });

  // --- Déconnexion
  btnLogout?.addEventListener('click', ()=>{
    import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js")
      .then(({signOut})=>signOut(window.auth))
      .catch(console.error);
  });

  // --- État d’auth
  import("https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js")
    .then(({ onAuthStateChanged, signOut })=>{
      onAuthStateChanged(window.auth, async (user)=>{
        if(user){
          // email non vérifié → refuse l'accès
          if(!user.emailVerified){
            errEl.textContent="Ton email n’est pas vérifié. Clique sur le lien reçu par email, puis reconnecte-toi.";
            try{ await signOut(window.auth); }catch{}
            showAuth(); 
            // réafficher le bouton “Créer un compte” côté UI de login
            openSignupBtn?.classList.remove('hidden');
            return;
          }
          // connecté et vérifié → affiche l’app
          currentUid=user.uid;
          showApp();
          // cache le bouton d’inscription + ferme la modale si ouverte
          openSignupBtn?.classList.add('hidden');
          if (signupModal && signupModal.style.display === 'block') {
            signupModal.style.display = 'none';
            signupModal.setAttribute('aria-hidden','true');
          }
          await initAppForUser(user.uid);
        }else{
          // déconnecté → affiche la page d’auth et le bouton d’inscription
          currentUid=null; 
          showAuth();
          openSignupBtn?.classList.remove('hidden');
        }
      });
    });
}

// Lance tout de suite si prêt, sinon attend le signal du HTML
if(window.auth && window.db){ bootstrap(); }
else{ window.addEventListener('firebase-ready', bootstrap, { once:true }); }

/* =========================
   Firestore (rappels)
========================= */
async function saveReminderForUser(uid,dateISO,note,time){
  const { doc,setDoc,serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js");
  const ref=doc(window.db,"users",uid,"reminders",dateISO);
  await setDoc(ref,{note:note||"",time:time||"",updatedAt:serverTimestamp()},{merge:true});
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
    .catch(()=>alert("Le son est bloqué. Appuie à nouveau si nécessaire."));
}

async function initAppForUser(uid){
  generateCalendar(currentMonth,currentYear);
  if(reminderTimerId) clearInterval(reminderTimerId);
  reminderTimerId=setInterval(checkRemindersFirestore,1000);
  if(!appBound){
    document.getElementById("closeAlertBtn")?.addEventListener("click",closeAlert);
    document.getElementById("calendar-time")?.addEventListener("input",()=>{
      const sb=document.getElementById("startButton"); if(sb) sb.style.display="block";
    });
    appBound=true;
  }
}

function mark(time,status){
  localStorage.setItem(time,status);
  const el=document.getElementById('status-'+time);
  if(el) el.innerText="Statut : "+status;
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
}

async function selectDate(date){
  selectedDate=date;
  document.getElementById('selected-date').innerText=date;
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
  if(!selectedDate) return alert('Veuillez sélectionner une date.');
  if(!currentUid)  return alert('Veuillez vous connecter.');
  const note=document.getElementById('calendar-note').value;
  const time=document.getElementById('calendar-time').value;
  await saveReminderForUser(currentUid,selectedDate,note,time);
  const msg=document.getElementById('calendar-msg');
  if(msg){ msg.style.display='inline'; setTimeout(()=>msg.style.display='none',2000); }
}

async function checkRemindersFirestore(){
  if(!currentUid||!audioEnabled||alarmTriggeredToday) return;
  const now=new Date();
  const dateStr=now.toISOString().split('T')[0];
  const timeStr=now.toTimeString().slice(0,5);
  const r=await getReminderForUser(currentUid,dateStr);
  if(r&&r.time===timeStr&&r.note){
    alarmTriggeredToday=true;
    const sound=document.getElementById('alarmSound');
    sound.play().catch(()=>{});
    document.getElementById('stopButton').style.display='block';
    showAlert('Rappel : '+r.note);
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
