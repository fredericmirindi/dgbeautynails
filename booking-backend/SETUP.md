# DG Nails - Online Booking Setup (Google Calendar + Email)

The website (`dgnail.ca`) now has an interactive multi-step online booking widget
(`booking.js`). To make confirmed bookings appear **automatically** in your
Google Calendar and inbox, connect the small Google Apps Script in this folder
(`Code.gs`). It runs for free under your own Google account - no server needed.

**Do everything below while logged into `nailswinnipeg@gmail.com`.**

## 1. Create the Apps Script project
1. Go to https://script.google.com and click **New project**.
2. Delete the sample code in `Code.gs`.
3. Open `booking-backend/Code.gs` from this repository, copy ALL of it, and paste
   it into the Apps Script editor.
4. Click the **Save** (disk) icon. Name the project `DG Nails Booking`.

## 2. Deploy it as a Web App
1. Click **Deploy** (top right) > **New deployment**.
2. Click the gear icon next to *Select type* and choose **Web app**.
3. Set the options:
   - **Description:** DG Nails booking endpoint
   - **Execute as:** *Me (nailswinnipeg@gmail.com)*
   - **Who has access:** *Anyone*
4. Click **Deploy**.
5. Click **Authorize access**, choose the `nailswinnipeg@gmail.com` account,
   and allow the Calendar + Gmail permissions. (If Google shows an
   "unverified app" screen, click *Advanced* > *Go to DG Nails Booking (unsafe)* -
   this is your own script, so it is safe.)
6. Copy the **Web app URL** shown (it ends in `/exec`).

## 3. Connect the website to your script
1. In this repository, open `booking.js`.
2. Near the top, find this line:
   ```js
   var ENDPOINT = "";
   ```
3. Paste your Web app URL between the quotes, e.g.:
   ```js
   var ENDPOINT = "https://script.google.com/macros/s/AKfy.../exec";
   ```
4. Commit the change. Within a minute, `dgnail.ca` is live with automatic bookings.

## 4. Test it
1. Visit https://www.dgnail.ca and click **Book an appointment**.
2. Pick a service, date, time, fill in your details and confirm.
3. Check that:
   - A new event appears in the `nailswinnipeg@gmail.com` Google Calendar.
   - A booking email arrives in the `nailswinnipeg@gmail.com` inbox.
   - The client receives a confirmation email (if they entered one).

## How it works
- `booking.js` builds the interactive booking experience on the site.
- On confirm, it sends the booking (service, date, time, client details) to your
  Apps Script Web App.
- `Code.gs` creates a Calendar event, emails you the details, and sends the
  client a friendly confirmation.
- Until `ENDPOINT` is set, the widget safely falls back to opening WhatsApp with
  the booking details pre-filled, so nothing breaks in the meantime.

## Customizing
- **Services / prices / durations:** edit the `SERVICES` array in `booking.js`.
- **Opening hours:** edit the `HOURS` object in `booking.js`.
- **Which calendar:** set `CALENDAR_ID` in `Code.gs` (default is your primary).
- **Email wording:** edit `notifySalon()` and `confirmClient()` in `Code.gs`.

> Note: after editing `Code.gs`, redeploy via **Deploy > Manage deployments >
> (edit) > New version** so your changes go live.
