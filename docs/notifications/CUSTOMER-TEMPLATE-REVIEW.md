# Customer notification copy — for review

Source of truth: `src/lib/notificationTemplates.js`. Super Admin can override a line in the app. Senders fall back to these words.

Outbound only. These go to the customer. There is no owner daily close text. Staff lines below are push inside the app, not SMS to the owner.

## Customer — visit status (app and SMS)

| When | App | SMS |
|---|---|---|
| Booking received | We received your {service} request at {branch}. We will confirm shortly. | Hakum: We got your {service} for {plate} at {branch}. We will confirm soon. |
| Confirmed | Your {service} is confirmed at {branch}. | Hakum: {service} CONFIRMED for {plate} at {branch}{when}. See you! |
| In the queue | {plate} is checked in for {service} at {branch}. | Hakum: {plate} checked in for {service} at {branch}. You are in queue. |
| In progress | Our team is working on your {service} for {plate}. | Hakum: Working on your {service} for {plate} now. |
| Final checking | {plate} ({service}) is on final QC. | Hakum: {plate} ({service}) is on final QC. Almost ready. |
| Ready to pay | Your {service} visit is ready for payment at the counter. | Hakum: {plate} ({service}) is ready — please proceed to payment. |
| Complete | Your {service} is complete. Thank you! | Hakum: {service} for {plate} is done. Thank you! Book: hakumautocare.com/book |
| Cancelled | Your {service} booking at {branch} was cancelled. | Hakum: Your {service} at {branch} was cancelled. Rebook anytime. |
| Photos ready | Progress photos for {plate} ({service}) are ready in the app. | Hakum: Photos for {plate} ({service}) are ready in the Hakum app. |

Queue, in-progress, final check, ready to pay, and complete SMS rotate among 20 lines unless that SMS text is edited.

## Customer — birthday, welcome, loyalty, reminders

| When | Channel | Copy |
|---|---|---|
| Birthday | App and SMS | Happy birthday, plus the birthday code. The perk lasts 7 days. |
| Welcome | SMS | Download the app at {appUrl} to book, track the car, and earn rewards. |
| Loyalty claim | SMS | Thank you for claiming your loyalty reward. |
| Visit 6 | SMS | Reward ready: free car freshener. Ask the branch. |
| Visit 12 | SMS | Reward ready: free coffee. Ask the branch. |
| Visit 18 | SMS | Reward ready: free premium car wash. Ask the branch. |
| Visit 24 | SMS | Reward ready: free back-to-zero add-on. Ask the branch. |
| Visit 30 | SMS | Reward ready: 15% off tint, ceramic coating, or PPF. Ask the branch. |
| Rate the visit | SMS | About 15 minutes after a completed visit. Link to the account. |
| Paint maintenance | App and SMS | {plate} is due. Book at hakumautocare.com/book. |

These five texts match the visit rewards. They send once, when completed visits hit that number. The old 4th-visit and 10th-visit stamp texts are no longer sent.

## Staff push (not a customer text)

New booking, confirmed, queue, in progress, final check, ready to pay, completed, cancelled, and a new complaint. These stay inside the app for the branch.
