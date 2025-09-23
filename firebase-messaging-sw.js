// firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js");

firebase.initializeApp({
  apiKey: "AIzaSyBfPvC5GtwKvG9TD7cLRo_WlPfifHhxfOU",
  authDomain: "productvues.firebaseapp.com",
  projectId: "productvues",
  storageBucket: "productvues.firebasestorage.app",
  messagingSenderId: "268641672431",
  appId: "1:268641672431:web:a4a5ec6d62fca218c5cf1a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // s’exécute quand un PUSH arrive et que la page est fermée
  self.registration.showNotification(payload.notification?.title || "Rappel", {
    body: payload.notification?.body || "",
    icon: "/logoalarm-192.png"
  });
});
