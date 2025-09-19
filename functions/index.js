import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import webpush from "web-push";

admin.initializeApp();
const db = admin.firestore();

// ==== VAPID ====
const VAPID_PUBLIC_KEY  = "BFSgNk48tjDovjdm0D9tVqKpNj80K9ko-8Ljw4cQDibk1n4tml42EQUywI4L26-GWWB_9UcEporrMRx_-9L1m-0";
const VAPID_PRIVATE_KEY = "REMPLACE_CECI_PAR_TA_CLE_PRIVEE";

webpush.setVapidDetails(
  "mailto:admin@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Planifié chaque minute (UTC)
export const tickSendReminders = functions.pubsub
  .schedule("* * * * *")
  .timeZone("UTC")
  .onRun(async () => {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm   = String(now.getUTCMonth()+1).padStart(2,'0');
    const dd   = String(now.getUTCDate()).padStart(2,'0');
    const HH   = String(now.getUTCHours()).padStart(2,'0');
    const MM   = String(now.getUTCMinutes()).padStart(2,'0');

    const dateUTC = `${yyyy}-${mm}-${dd}`;
    const timeUTC = `${HH}:${MM}`;

    const snap = await db.collectionGroup("reminders")
      .where("dateUTC","==",dateUTC)
      .where("timeUTC","==",timeUTC)
      .where("sent","==",false)
      .get();

    if (snap.empty) return null;

    const jobs = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const uid = docSnap.ref.parent.parent.id; // users/{uid}/reminders/{doc}
      jobs.push(sendToUser(uid, data.note || "Rappel médical", docSnap.ref));
    });

    await Promise.allSettled(jobs);
    return null;
  });

async function sendToUser(uid, note, reminderRef){
  const subsSnap = await db.collection("users").doc(uid).collection("subscriptions").get();
  if (subsSnap.empty){
    await reminderRef.set({sent:true},{merge:true});
    return;
  }

  const payload = JSON.stringify({
    title: "Rappel médical",
    body: note || "Il est l’heure.",
    url: "/"
  });

  const sends = [];
  subsSnap.forEach(s => {
    const sub = { endpoint: s.get('endpoint'), keys: s.get('keys') };
    sends.push(webpush.sendNotification(sub, payload).catch(async err=>{
      if (err.statusCode === 410 || err.statusCode === 404) {
        await s.ref.delete();
      } else {
        console.error("push error", err.statusCode, err.body);
      }
    }));
  });

  await Promise.allSettled(sends);
  await reminderRef.set({sent:true},{merge:true});
}
