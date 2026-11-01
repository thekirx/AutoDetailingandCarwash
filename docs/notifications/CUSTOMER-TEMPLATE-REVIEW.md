# Hakum Auto Care — Customer Notifications Template Review (App & SMS)

> **Purpose:** Official review catalog of all customer-facing notifications in the Hakum Auto Care platform across **In-App / Web Push** and **SMS** channels.  
> **Source of Truth:** `src/lib/notificationTemplates.js`, `src/lib/queueStatusSmsTemplates.js`, `src/lib/detailingBookingSms.js`, `src/lib/lifecycleSms.mjs`, `server/notifyBooking.mjs`.  
> **Customization & Overrides:** Super Admin can review, enable/disable, or override template copy via the Admin Console (`/admin/notifications`). When unedited, the platform uses dynamic rotation pools to prevent repetitive messages.

---

## 1. Delivery Channels & Technical Architecture

| Channel | Delivery Mechanism | Destination | Sender Identity / URL | Character Limits & Handling |
| :--- | :--- | :--- | :--- | :--- |
| **SMS** | **BusyBee BrandTxT API** (`SendSMS` v2/v3) | Customer mobile handset | `HAKUM` | Single GSM segment: **160 chars** (concatenated segment: 153 chars, hard cap: 1,000 chars). Numbers normalized to `639XXXXXXXXX`. |
| **In-App / Push** | **Web Push** (VAPID / Service Worker) + **DB Inbox** (`user_notifications`) | Customer Account portal & device notification shade | `hakumautocare.com/account` | Push title max: **65 chars**; push body max: **200 chars**. Click directs to `/account`, `/account/queue`, or `/account/visit/:id`. |

---

## 2. Real-Time Operational Queue & Bay Status (Side-by-Side Review)

These notifications fire as a vehicle moves across the physical shop workflow (Carwash and Detailing bays).

| Operational Stage | In-App / Push Title | In-App / Push Body | SMS Copy (Default / Edited Fallback) | SMS Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **1. Waiting / In Queue** | `In the queue` | `{plate} is checked in for {service} at {branch}.` | `Hakum: {plate} checked in for {service} at {branch}. You are in queue.` | **Rotates across 20 friendly message variants** (see Section 3.1). Injects customer `{Name}` and `{Car}`. |
| **2. In Progress / Washing** | `Service in progress` | `Our team is working on your {service} for {plate}.` | `Hakum: Working on your {service} for {plate} now.` | **Rotates across 20 friendly message variants** (see Section 3.2). Injects customer `{Name}` and `{Car}`. |
| **3. Final QC / Inspection** | `Final checking` | `{plate} ({service}) is on final QC.` | `Hakum: {plate} ({service}) is on final QC. Almost ready.` | **Rotates across 20 friendly message variants** (see Section 3.3). Focuses on quality assurance inspection. |
| **4. Ready for Payment** | `Ready for payment` | `Your {service} visit is ready for payment at the counter.` | `Hakum: {plate} ({service}) is ready — please proceed to payment.` | **Rotates across 20 cashier call variants** (see Section 3.4). Prepend `Hi {Name}!` when customer name exists. |
| **5. Service Complete** | `Service complete` | `Your {service} is complete. Thank you!` | `Hakum: {service} for {plate} is done. Thank you! Book: hakumautocare.com/book` | **Rotates across 20 thank-you variants** (see Section 3.5). Includes warm sign-off and rebook link. |
| **6. Booking Cancelled** | `Booking cancelled` | `Your {service} booking at {branch} was cancelled.` | `Hakum: Your {service} at {branch} was cancelled. Rebook anytime.` | Static template. Fired if booking is cancelled by shop or customer. |
| **7. Progress Photos Ready** | `Progress photos ready` | `Progress photos for {plate} ({service}) are ready in the app.` | `Hakum: Photos for {plate} ({service}) are ready in the Hakum app.` | Fired when detailers or crew upload progress/inspection photos. |

> [!NOTE]
> **Internal Quality Assurance Redo Rule:** If a vehicle fails final inspection and undergoes a rework/redo (`redo_at`), status movements back through *In Progress* and *Final Checking* are strictly **silent** to the customer. SMS and Push resume only when the car reaches *For Payment* and *Completed*.

---

## 3. Operational SMS Rotation Pools (20 Variants Per Stage)

To ensure repeat customers never receive robotic, repetitive messages, the system randomly selects one of 20 verified variations for each operational event unless overridden by Super Admin.

### 3.1 Stage 1: Waiting / In Queue (20 Variants)
*Informs customer their vehicle is checked in and queued.*

| # | Message Copy | Has Name | Has Car | Taglish | Chars |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | `Hi {Name}! We've checked in your {Car}. We'll begin shortly, thank you for waiting.` | Y | Y | N | 83 |
| 2 | `Good day, {Name}! Your {Car} is in line for service. Thanks for your patience!` | Y | Y | N | 78 |
| 3 | `Welcome to Hakum, {Name}! Your {Car} is up next. Feel free to relax while you wait.` | Y | Y | N | 83 |
| 4 | `Hello {Name}, your {Car} is on our list and will be started shortly. Salamat po!` | Y | Y | Y | 80 |
| 5 | `Hi {Name}! Thanks for dropping off your {Car}. We'll get to it very soon.` | Y | Y | N | 73 |
| 6 | `Hi {Name}, your {Car} is in the queue. Please enjoy our waiting area in the meantime.` | Y | Y | N | 85 |
| 7 | `Thank you, {Name}! Your {Car} is ready to be served next.` | Y | Y | N | 57 |
| 8 | `Hello {Name}! Our team is preparing to start on your {Car}. Thanks for waiting!` | Y | Y | N | 79 |
| 9 | `Hi {Name}, we appreciate your patience! Your {Car} is next in our service line.` | Y | Y | N | 79 |
| 10 | `Good day {Name}! Your {Car} is checked in. We'll text you once we begin.` | Y | Y | N | 72 |
| 11 | `Hi {Name}! Your {Car} is queued up. We'll take great care of it shortly.` | Y | Y | N | 72 |
| 12 | `Welcome, {Name}! We've logged your {Car} and will start as soon as a bay opens.` | Y | Y | N | 79 |
| 13 | `Hello {Name}, thanks for choosing Hakum! Your {Car} is next up for service.` | Y | Y | N | 75 |
| 14 | `Hi {Name}, your {Car} is waiting for its turn. It won't be long now!` | Y | Y | N | 68 |
| 15 | `Thank you for your patience, {Name}. Your {Car} will be in our bay shortly.` | Y | Y | N | 75 |
| 16 | `Hi {Name}! We've received your {Car} and our team will begin soon. Salamat po!` | Y | Y | Y | 78 |
| 17 | `Good day, {Name}! Your {Car} is next in line. Please make yourself at home.` | Y | Y | N | 75 |
| 18 | `Hello {Name}, your {Car} is checked in. We'll update you as soon as we start.` | Y | Y | N | 77 |
| 19 | `Hi {Name}! Thanks for your trust. Your {Car} will be served in just a bit.` | Y | Y | N | 74 |
| 20 | `Hi {Name}, your {Car} is almost up! We'll start in a few minutes. Thank you!` | Y | Y | N | 76 |

---

### 3.2 Stage 2: In-Progress / Bay Work Underway (20 Variants)
*Informs customer service has physically begun on their car.*

| # | Message Copy | Has Name | Has Car | Taglish | Chars |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | `Hi {Name}! We've just started working on your {Car}. We'll keep you updated.` | Y | Y | N | 76 |
| 2 | `Hello {Name}, your {Car} is now in the hands of our team. Thanks for waiting!` | Y | Y | N | 77 |
| 3 | `Good news, {Name}! Service on your {Car} is officially underway.` | Y | Y | N | 64 |
| 4 | `Hi {Name}, we're taking good care of your {Car} right now. Won't be long!` | Y | Y | N | 73 |
| 5 | `Hello {Name}! Your {Car} is in the bay and getting the full Hakum treatment.` | Y | Y | N | 76 |
| 6 | `Hi {Name}, our team is hard at work on your {Car}. We'll message you soon.` | Y | Y | N | 74 |
| 7 | `Good day {Name}! Your {Car} is being cleaned with care. Thank you for your patience.` | Y | Y | N | 84 |
| 8 | `Hi {Name}! We've begun on your {Car}. Sit back and relax, we've got it covered.` | Y | Y | N | 79 |
| 9 | `Hello {Name}, your {Car} is now being serviced. We'll let you know once we're done.` | Y | Y | N | 83 |
| 10 | `Hi {Name}, your {Car} is getting some well-deserved attention. Almost there!` | Y | Y | N | 76 |
| 11 | `Great news, {Name}! We're now working on your {Car}. Thanks for trusting us.` | Y | Y | N | 76 |
| 12 | `Hi {Name}! Your {Car} is currently in service. We'll update you shortly.` | Y | Y | N | 72 |
| 13 | `Hello {Name}, we're giving your {Car} our full attention right now. Salamat po!` | Y | Y | Y | 79 |
| 14 | `Hi {Name}, your {Car} is in progress and looking better by the minute!` | Y | Y | N | 70 |
| 15 | `Good day {Name}! Our team is carefully working on your {Car}. Thank you for waiting.` | Y | Y | N | 84 |
| 16 | `Hi {Name}! Service on your {Car} has started. We'll text you with the next update.` | Y | Y | N | 82 |
| 17 | `Hello {Name}, your {Car} is being pampered as we speak. Thank you for your patience!` | Y | Y | N | 84 |
| 18 | `Hi {Name}, we're on it! Your {Car} is now being taken care of by our team.` | Y | Y | N | 74 |
| 19 | `Good news {Name}, we've started on your {Car}. We'll let you know when it's ready.` | Y | Y | N | 82 |
| 20 | `Hi {Name}! Your {Car} is in good hands. We'll be done before you know it.` | Y | Y | N | 73 |

---

### 3.3 Stage 3: Final Inspection / QC (20 Variants)
*Assures customer of meticulous quality inspection before handover.*

| # | Message Copy | Has Name | Has Car | Taglish | Chars |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | `We're giving everything one last careful check. Thank you for your patience!` | N | N | N | 76 |
| 2 | `Almost there! Our team is doing a final walkthrough to make sure it's perfect.` | N | N | N | 78 |
| 3 | `Just a final inspection left. We want every detail to be just right for you.` | N | N | N | 76 |
| 4 | `Final quality check in progress. We'll have you on the road very soon!` | N | N | N | 70 |
| 5 | `We're taking one last look at every detail. Thanks so much for waiting.` | N | N | N | 71 |
| 6 | `Nearly done! Our team is making sure everything meets our standards.` | N | N | N | 68 |
| 7 | `A final once-over is underway. We want you to drive off completely happy.` | N | N | N | 73 |
| 8 | `Last step! We're inspecting every corner to make sure it's flawless.` | N | N | N | 68 |
| 9 | `Final checks are in progress. Thank you for being so patient with us!` | N | N | N | 69 |
| 10 | `We're polishing off the last details. Just a few more minutes, thank you!` | N | N | N | 73 |
| 11 | `Our team is doing a final inspection. We take pride in getting it right.` | N | N | N | 72 |
| 12 | `Just a quick final review before we hand it back. Almost ready for you!` | N | N | N | 71 |
| 13 | `Final touches are underway. We appreciate your patience and trust.` | N | N | N | 66 |
| 14 | `One last check to make sure your ride looks its best. Won't be long now!` | N | N | N | 72 |
| 15 | `We're in the final stretch! Doing a last inspection to be sure it's perfect.` | N | N | N | 76 |
| 16 | `Almost ready! We're making sure every detail is spotless for you.` | N | N | N | 65 |
| 17 | `Final inspection time. We want you to be proud of the result!` | N | N | N | 61 |
| 18 | `Wrapping things up with one last careful look. Thanks for waiting!` | N | N | N | 66 |
| 19 | `Just finishing our last quality check. We'll let you know very soon.` | N | N | N | 68 |
| 20 | `We're double-checking everything so you get the best result. Almost done!` | N | N | N | 73 |

---

### 3.4 Stage 4: For Payment / Settle at Cashier (20 Variants)
*Notifies customer their car is ready and requests payment at the counter.*  
*(Note: If customer name is known, the system automatically prepends `Hi {Name}!`)*

| # | Message Copy | Has Name | Has Car | Taglish | Chars |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | `All done on our end! Please proceed to the cashier whenever you're ready. Thank you!` | Optional | N | N | 84 |
| 2 | `Your vehicle is ready! Kindly drop by the cashier to settle your payment.` | Optional | N | N | 73 |
| 3 | `We're finished and it looks great! Please see our cashier when you're ready.` | Optional | N | N | 76 |
| 4 | `Everything is set! Kindly head to the cashier to complete your payment. Salamat po!` | Optional | N | Y | 83 |
| 5 | `Service is done! Our cashier will be glad to assist you with payment.` | Optional | N | N | 69 |
| 6 | `Ready when you are! Just a quick stop at the cashier and you're good to go.` | Optional | N | N | 75 |
| 7 | `All wrapped up! Please proceed to the counter for payment at your convenience.` | Optional | N | N | 78 |
| 8 | `We hope you love the result! Kindly settle your payment at the cashier.` | Optional | N | N | 71 |
| 9 | `Your ride is looking its best! Please pass by the cashier to finish up.` | Optional | N | N | 71 |
| 10 | `Good news, we're done! Kindly proceed to the cashier for payment. Thank you po!` | Optional | N | Y | 79 |
| 11 | `All finished and sparkling! Our cashier is ready to assist you.` | Optional | N | N | 63 |
| 12 | `Your vehicle is ready for release. Please settle payment at the counter. Thank you!` | Optional | N | N | 83 |
| 13 | `Thanks for your patience! You may now proceed to the cashier for payment.` | Optional | N | N | 73 |
| 14 | `We're all set on our end! Kindly visit the cashier whenever it's convenient.` | Optional | N | N | 76 |
| 15 | `Done and ready for you! Please stop by the counter to complete your payment.` | Optional | N | N | 76 |
| 16 | `Everything looks perfect! Our cashier is ready whenever you are. Salamat po!` | Optional | N | Y | 76 |
| 17 | `Service complete! Kindly proceed to payment, then you're free to drive off.` | Optional | N | N | 75 |
| 18 | `We've finished and we think you'll love it! Please see our cashier.` | Optional | N | N | 67 |
| 19 | `Your car is ready! A quick payment at the cashier and you're all set.` | Optional | N | N | 69 |
| 20 | `All done! Thank you for waiting. Please proceed to the cashier at your pace.` | Optional | N | N | 76 |

---

### 3.5 Stage 5: Service Completed / Released (20 Variants)
*Customer appreciation and re-engagement text upon release.*

| # | Message Copy | Has Name | Has Car | Taglish | Chars |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | `Thank you, {Name}! It was a pleasure serving you. Drive safe and see you again soon!` | Y | N | N | 84 |
| 2 | `All done, {Name}! We hope you love the shine. Safe travels!` | Y | N | N | 59 |
| 3 | `{Name}, thank you for trusting Hakum Auto Care with your ride. Take care on the road!` | Y | N | N | 85 |
| 4 | `Service complete! Thanks for visiting, {Name}. We hope to see you again soon.` | Y | N | N | 77 |
| 5 | `It was great taking care of your car, {Name}. Drive safe and come back anytime!` | Y | N | N | 79 |
| 6 | `Salamat po, {Name}! We truly appreciate your trust. Drive safe!` | Y | N | Y | 63 |
| 7 | `Thank you for choosing us, {Name}! We hope your ride feels brand new.` | Y | N | N | 69 |
| 8 | `{Name}, we enjoyed serving you today. Have a wonderful day ahead!` | Y | N | N | 65 |
| 9 | `Your service is complete, {Name}. Thank you for being part of the Hakum family!` | Y | N | N | 79 |
| 10 | `Thanks for stopping by, {Name}! Enjoy the clean ride and drive safely.` | Y | N | N | 70 |
| 11 | `Thank you for your support, {Name}. We're always here whenever you need us!` | Y | N | N | 75 |
| 12 | `All finished, {Name}! It was our pleasure. Safe travels and see you next time.` | Y | N | N | 78 |
| 13 | `We appreciate you, {Name}! Thank you for letting us care for your car.` | Y | N | N | 70 |
| 14 | `Service completed! Thank you, {Name}. Wishing you a safe and pleasant drive.` | Y | N | N | 76 |
| 15 | `{Name}, thank you for visiting Hakum Auto Care! We hope to see you again soon.` | Y | N | N | 78 |
| 16 | `Thank you, {Name}, for your trust and patience. Drive safe out there!` | Y | N | N | 69 |
| 17 | `It was a pleasure, {Name}! Enjoy your freshly cared-for ride.` | Y | N | N | 61 |
| 18 | `Salamat po sa pagbisita, {Name}! Ingat sa biyahe and see you again soon!` | Y | N | Y | 72 |
| 19 | `All done, {Name}! Thank you for choosing us. Have a great day ahead!` | Y | N | N | 68 |
| 20 | `{Name}, thank you for letting us take care of your vehicle. Until next time!` | Y | N | N | 76 |

---

## 4. Detailing Booking Lifecycle Notifications

Detailing involves calendar appointments, specialist allocation, and upfront coordination.

### 4.1 Detailing Booking Received (Customer Web Submission — Tentative)
*Trigger:* Customer requests an appointment via `hakumautocare.com/book`. Date is marked tentative until phone verification.  
*In-App Title / Body:* `Booking received` · `We received your {service} request at {branch}. We will confirm shortly.`  
*SMS Rotation (5 Variants):*

| # | Detailing Customer Booking SMS Copy | Taglish | Chars |
| :---: | :--- | :---: | :---: |
| 1 | `Hi {FirstName}! Thank you for choosing Hakum Auto Care. We received your booking for {Service} on your {Car}, tentatively on {Date}. Our customer representative will contact you shortly to confirm your schedule. Salamat po!` | Y | 223 |
| 2 | `Hello {FirstName}, thanks for choosing Hakum! Your {Service} booking for your {Car} is received, tentatively set for {Date}. One of our customer representatives will reach out to confirm your schedule. Thank you!` | N | 212 |
| 3 | `Hi {FirstName}! We're glad you chose Hakum Auto Care. Your {Car} is tentatively booked for {Service} on {Date}. Our customer representative will be in touch soon to confirm your schedule. Salamat po!` | Y | 199 |
| 4 | `Good day {FirstName}! Thank you for booking with Hakum. We've noted {Service} for your {Car} on {Date} (tentative). A customer representative will contact you to confirm the schedule. Thank you po!` | Y | 197 |
| 5 | `Thank you for trusting Hakum Auto Care, {FirstName}! We got your request for {Service} on your {Car}, tentatively {Date}. Our customer representative will call or text soon to confirm your schedule. Salamat po!` | Y | 210 |

---

### 4.2 Detailing Booking Confirmed (Crew / Staff Confirmed Slot)
*Trigger:* Staff books on behalf of a customer, or confirms a web booking. If a detailer specialist is assigned, their name is appended (`Your specialist is {Specialist}.`).  
*In-App Title / Body:* `Booking confirmed` · `Your {service} is confirmed at {branch}.`  
*SMS Rotation (5 Variants):*

| # | Detailing Crew Confirmed Booking SMS Copy | Taglish | Chars |
| :---: | :--- | :---: | :---: |
| 1 | `Hi {FirstName}! Thank you for choosing Hakum Auto Care. Your {Service} for your {Car} is confirmed on {Date}. We look forward to seeing you. Salamat po!` | Y | 152 |
| 2 | `Hello {FirstName}! Your booking is confirmed. We'll take care of your {Car} for {Service} on {Date}. Thank you for trusting Hakum Auto Care!` | N | 140 |
| 3 | `Good day {FirstName}! This is to confirm your {Service} appointment for your {Car} on {Date}. We can't wait to serve you. Salamat po!` | Y | 133 |
| 4 | `Hi {FirstName}, you're all set! Your {Car} is booked for {Service} on {Date}. Thank you for choosing Hakum, we'll see you then!` | N | 127 |
| 5 | `Thank you for booking with Hakum Auto Care, {FirstName}! Your {Service} for your {Car} is scheduled and confirmed for {Date}. See you soon, salamat po!` | Y | 151 |

---

### 4.3 Detailing Appointment Reminders (7 Days, 3 Days, and 1 Day Prior)
*Trigger:* Automatic automated cron job checking upcoming scheduled detailing appointments. Dispatched once per offset via **In-App push** and **SMS**.

| Offset | In-App / Push Title | SMS Copy & Push Body |
| :---: | :--- | :--- |
| **7 Days Prior** | `Detailing in 7 days` | `Hi {first}! Reminder: your {service} for your {car} at Hakum is in 7 days ({when}). Reply is not needed — just come on that schedule.` |
| **3 Days Prior** | `Detailing in 3 days` | `Hi {first}! Reminder: your {service} for your {car} at Hakum is in 3 days ({when}). Reply is not needed — just come on that schedule.` |
| **1 Day Prior** | `Detailing tomorrow` | `Hi {first}! Reminder: your {service} for your {car} at Hakum is tomorrow ({when}). Reply is not needed — just come on that schedule.` |

---

### 4.4 Customer Reschedule Request Acknowledgement
*Trigger:* Customer requests a date change from their portal before work commences.  
*In-App Title:* `Reschedule request received`  
*In-App Body & SMS:*  
`Hi {FirstName}! We received your request to reschedule. One of our customer representatives will contact you as soon as possible. Salamat po!`

---

## 5. Lifecycle, Retention & Loyalty Notifications

| Trigger / Milestone | Channel | In-App / Push Title | Message Copy (SMS & Push Body) |
| :--- | :--- | :--- | :--- |
| **Welcome / App Download** | SMS | — | `Welcome to Hakum Auto Care! Thank you for joining us. Download our app at {appUrl} to book visits, track your car live, and earn loyalty rewards. Enjoy the full Hakum experience!` |
| **Loyalty Reward Claimed** | SMS | — | `Hakum Auto Care: Thank you for claiming your loyalty reward! Keep those visits coming, your next treat is already on the way.` |
| **Visit 6 Milestone** | SMS | — | `Hakum Auto Care: That's visit 6. Your reward is ready: Free car freshener. Ask the branch.` |
| **Visit 12 Milestone** | SMS | — | `Hakum Auto Care: That's visit 12. Your reward is ready: Free coffee. Ask the branch.` |
| **Visit 18 Milestone** | SMS | — | `Hakum Auto Care: That's visit 18. Your reward is ready: Free premium car wash. Ask the branch.` |
| **Visit 24 Milestone** | SMS | — | `Hakum Auto Care: That's visit 24. Your reward is ready: Free back-to-zero add-on. Ask the branch.` |
| **Visit 30 Milestone** | SMS | — | `Hakum Auto Care: That's visit 30. Your reward is ready: 15% off tint, ceramic coating, or PPF. Ask the branch.` |
| **Rate Your Visit (Post-Visit)** | SMS | — | `Hakum Auto Care: How was your visit? Open your account ({appUrl}/account) to rate it — thumbs up or tell us what went wrong.` *(Fired ~15 minutes post-payment)* |
| **Birthday Greeting & Perk** | In-App + SMS | `Happy birthday from Hakum` | **Push Body:** `Happy birthday {name}! Enjoy a Free Car Wash or Detailing Discount on us. Your code is {code}. Show it at any Hakum branch. It lasts 7 days.`<br>**SMS:** `Hakum Auto Care: Happy birthday {name}! Your Free Car Wash or Detailing Discount is ready. Your birthday code is {code}. Show it at the branch. It lasts 7 days.` |
| **Birthday In-Bay Start** | In-App + SMS | `Happy birthday` | `Hakum Auto Care: Happy birthday {name}! We started on your car. Show code {code} at the counter. It lasts 7 days.` |
| **Ceramic / Paint Maintenance Due** | In-App + SMS | `Hakum Auto Care: Time for paint maintenance` | `Hi {name}, {plate} is due for paint maintenance. Book your next visit at hakumautocare.com/book.` |

---

## 6. Dynamic Variables & Personalization Dictionary

| Placeholder Token | Resolved Value Source | Fallback Handling |
| :--- | :--- | :--- |
| `{FirstName}` / `{Name}` | Customer first name from profile (`customers.full_name`) or booking | Omitted cleanly in SMS (e.g. `Hi {Name}!` becomes omitted without leaving trailing punctuation or empty spaces); or falls back to `there` / `Customer`. Walk-in placeholder names (`Walk-in 1234`) are never sent. |
| `{Car}` | Vehicle make + model (e.g. `Toyota Fortuner`) | Falls back to vehicle plate (`ABC1234`), then to `vehicle`. |
| `{plate}` | Vehicle license plate / conduction sticker (`vehicle_plate`) | Falls back to `your vehicle`. |
| `{service}` | Service or package name (e.g. `Ceramic Coating`) | Truncated to 25 chars + `…` if longer than 28 chars to protect SMS single-segment limits. |
| `{branch}` | Friendly branch name (e.g. `Hakum Bacoor`) | Falls back to `Hakum`. |
| `{Date}` / `{when}` | Formatted scheduled appointment date & time (Philippine Time `Asia/Manila`) | Formatted e.g. `Nov 12, 2026, 9:00 AM`. |
| `{code}` | Unique 6 to 8-character promotional or birthday claim code | Generated cryptographically from `customer_birthday_perks`. |
| `{appUrl}` | Base web portal URL (e.g. `hakumautocare.com`) | Falls back to `hakumautocare.com`. |

---

## 7. Review Checklist for Management & Marketing

- [x] **Character Length Verification:** All operational queue SMS templates are under 90 characters (well within the 160-character GSM-7 single SMS boundary).
- [x] **Taglish Inclusions:** Select friendly Taglish closings (`Salamat po!`, `Ingat sa biyahe`) are provided in rotation to maintain a warm local Filipino hospitality tone.
- [x] **Anti-Repetition:** 20 variants for each carwash queue stage + 5 variants for detailing bookings ensure customers with frequent visits do not receive identical texts.
- [x] **Customer Opt-Out & Safety:** All SMS sends check `sms_notifications.enabled` setting and customer `sms_opt_in` preferences. All transactions are logged to `sms_events`.
- [x] **Staff Push Isolation:** Staff operational pushes remain strictly inside the app/web push and never incur external SMS costs.
