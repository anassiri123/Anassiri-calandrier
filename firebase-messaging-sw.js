// firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js");

// ⚡ Ta config Firebase (la même que dans index.html)
firebase.initializeApp({
  apiKey: "AIzaSyBfPvC5GtwKvG9TD7cLRo_WlPfifHhxfOU",
  authDomain: "productvues.firebaseapp.com",
  projectId: "productvues",
  storageBucket: "productvues.firebasestorage.app",
  messagingSenderId: "268641672431",
  appId: "1:268641672431:web:a4a5ec6d62fca218c5cf1a"
});

// Initialiser messaging
const messaging = firebase.messaging();

// Quand une notification arrive en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Notification reçue en arrière-plan :", payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/logoalarm.jpg" // icône de ta notif
  });
});
