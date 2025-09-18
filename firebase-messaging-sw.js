// firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js");

// Même config que l'app
firebase.initializeApp({
  apiKey: "AIzaSyBfPvC5GtwKvG9TD7cLRo_WlPfifHhxfOU",
  authDomain: "productvues.firebaseapp.com",
  projectId: "productvues",
  storageBucket: "productvues.firebasestorage.app",
  messagingSenderId: "268641672431",
  appId: "1:268641672431:web:a4a5ec6d62fca218c5cf1a"
});

const messaging = firebase.messaging();

// Notification reçue en arrière-plan (quand tu enverras via serveur)
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Notification en arrière-plan :", payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/logoalarm-192.png" // icône de notif
  });
});
