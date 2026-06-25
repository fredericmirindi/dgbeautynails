/**
 * DG Nails - Booking backend (Google Apps Script Web App)
 * Receives a booking from the website (booking.js) and:
 *   1) Creates an event in the Google Calendar of the account running this script
 *   2) Emails the booking details to the salon
 *   3) Sends a friendly confirmation email to the client (if email given)
 *
 * RUN THIS UNDER THE nailswinnipeg@gmail.com GOOGLE ACCOUNT.
 * Full setup steps are in booking-backend/SETUP.md
 */

// ====== SETTINGS ======
var SALON_NAME = "DG Nails";
var SALON_EMAIL = "nailswinnipeg@gmail.com"; // where you receive bookings
var SALON_ADDRESS = "261-A Vaughan Street, Winnipeg, Manitoba, R3C 1T8, Canada";
var CALENDAR_ID = "primary"; // or paste a specific calendar ID
var TIMEZONE = "America/Winnipeg";

// Handle the POST coming from the website.
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    createCalendarEvent(data);
    notifySalon(data);
    if (data.email) confirmClient(data);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// Simple GET so you can verify the Web App is live in a browser.
function doGet() {
  return ContentService.createTextOutput("DG Nails booking endpoint is live.");
}

function createCalendarEvent(d) {
  var cal = (CALENDAR_ID === "primary")
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(CALENDAR_ID);
  var start = new Date(d.startISO);
  var end = new Date(d.endISO);
  var title = SALON_NAME + " \u2013 " + d.service + " (" + d.name + ")";
  var desc = [
    "Service: " + d.service + "  ($" + d.price + ")",
    "Client: " + d.name,
    "Phone: " + d.phone,
    "Email: " + (d.email || "\u2014"),
    "Notes: " + (d.notes || "\u2014"),
    "Booked online via dgnail.ca"
  ].join("\n");
  var ev = cal.createEvent(title, start, end, {
    description: desc,
    location: SALON_ADDRESS
  });
  try { ev.addPopupReminder(60); } catch (x) {}
  if (d.email) { try { ev.addGuest(d.email); } catch (x) {} }
  return ev;
}

function notifySalon(d) {
  var subject = "New booking: " + d.service + " \u2013 " + d.dateText + " " + d.timeText;
  var body = [
    "You have a new online booking request.",
    "",
    "Service:  " + d.service + "  ($" + d.price + ")",
    "Date:     " + d.dateText,
    "Time:     " + d.timeText + "  (" + d.durationMins + " min)",
    "",
    "Client:   " + d.name,
    "Phone:    " + d.phone,
    "Email:    " + (d.email || "\u2014"),
    "Notes:    " + (d.notes || "\u2014"),
    "",
    "This event was added to your Google Calendar automatically."
  ].join("\n");
  MailApp.sendEmail(SALON_EMAIL, subject, body, { replyTo: d.email || SALON_EMAIL });
}

function confirmClient(d) {
  var subject = SALON_NAME + ": we received your booking request";
  var body = [
    "Hello " + d.name + ",",
    "",
    "Thank you for booking with " + SALON_NAME + "! We received your request:",
    "",
    "  \u2022 Service: " + d.service + " ($" + d.price + ")",
    "  \u2022 Date: " + d.dateText,
    "  \u2022 Time: " + d.timeText,
    "",
    "We will personally confirm your appointment shortly. If you need to make a",
    "change, simply reply to this email or call us.",
    "",
    SALON_NAME,
    SALON_ADDRESS
  ].join("\n");
  MailApp.sendEmail(d.email, subject, body, { name: SALON_NAME, replyTo: SALON_EMAIL });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
