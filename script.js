let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let audioEnabled = false;
let alarmTriggeredToday = false;

function startApp() {
  audioEnabled = true;
  document.getElementById('startButton').style.display = 'none';
  const sound = document.getElementById('alarmSound');
  sound.play().then(() => {
    sound.pause();
    sound.currentTime = 0;
  }).catch(() => {
    alert("Le son est bloqué. Appuie à nouveau si nécessaire.");
  });
}

window.onload = function () {
  ['matin', 'midi', 'soir'].forEach(t => {
    const status = localStorage.getItem(t);
    if (status) document.getElementById('status-' + t).innerText = "Statut : " + status;
  });
  generateCalendar(currentMonth, currentYear);
  setInterval(checkReminders, 1000);

  document.getElementById("closeAlertBtn").addEventListener("click", closeAlert);

  document.getElementById("calendar-time").addEventListener("input", function () {
    document.getElementById("startButton").style.display = "block";
  });
};

function mark(time, status) {
  localStorage.setItem(time, status);
  document.getElementById('status-' + time).innerText = "Statut : " + status;
}

function generateCalendar(month, year) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let html = '<table><tr>';
  for (let d of days) html += '<th>' + d + '</th>';
  html += '</tr><tr>';
  for (let i = 0; i < firstDay; i++) html += '<td></td>';
  for (let day = 1; day <= daysInMonth; day++) {
    const fullDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    html += `<td onclick="selectDate('${fullDate}')">${day}</td>`;
    if ((day + firstDay) % 7 === 0) html += '</tr><tr>';
  }
  html += '</tr></table>';
  document.getElementById('calendar').innerHTML = html;
  document.getElementById('month-year').innerText =
    new Date(year, month).toLocaleString('fr-FR', { month: 'long' }) + ' ' + year;
}

function changeMonth(offset) {
  currentMonth += offset;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  generateCalendar(currentMonth, currentYear);
}

function selectDate(date) {
  selectedDate = date;
  document.getElementById('selected-date').innerText = date;
  document.getElementById('calendar-note').value = localStorage.getItem('reminder-' + date) || '';
  document.getElementById('calendar-time').value = localStorage.getItem('time-' + date) || '';
}

function saveCalendarNote() {
  if (!selectedDate) return alert('Veuillez sélectionner une date.');
  const note = document.getElementById('calendar-note').value;
  const time = document.getElementById('calendar-time').value;
  localStorage.setItem('reminder-' + selectedDate, note);
  localStorage.setItem('time-' + selectedDate, time);
  const msg = document.getElementById('calendar-msg');
  msg.style.display = 'inline';
  setTimeout(() => msg.style.display = 'none', 2000);
}

function checkReminders() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0, 5);
  const savedTime = localStorage.getItem('time-' + dateStr);
  const savedNote = localStorage.getItem('reminder-' + dateStr);
  if (savedTime === timeStr && savedNote && audioEnabled && !alarmTriggeredToday) {
    alarmTriggeredToday = true;
    const sound = document.getElementById('alarmSound');
    sound.play().catch(() => {});
    document.getElementById('stopButton').style.display = 'block';
    showAlert('Rappel : ' + savedNote);
    if (navigator.vibrate) navigator.vibrate(500);
  }
}

function stopAlarm() {
  const sound = document.getElementById('alarmSound');
  sound.pause();
  sound.currentTime = 0;
  closeAlert();
  document.getElementById('stopButton').style.display = 'none';
}

function showAlert(message) {
  document.getElementById('alert-message').innerText = message;
  document.getElementById('custom-alert').style.display = 'flex';
}

function closeAlert() {
  document.getElementById('custom-alert').style.display = 'none';
}

