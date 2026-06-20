# RevRemind Demo Screencast — Production Plan v2 (2026-06-20)

Format: 1920x1080 MP4, silent with on-screen English captions (satisfies 4.5.3 language rule).
Target length: 55 to 70 seconds. Built from real screenshots of the live app, assembled in ffmpeg with slow zoom and crossfades so it flows like a guided product tour.
Captions: no em dashes anywhere. Each step states the action plainly.

The video must answer the reviewer's exact doubt: show the full setup AND an email actually being sent with no error, end to end.

## Storyboard (beats)

0. TITLE (3s)
   RevRemind
   Automated maintenance reminders that bring auto parts customers back

1. DASHBOARD (6s)
   Caption: How RevRemind works
   Sub: Capture each customer's vehicle, then remind them when service is due
   Screen: app dashboard (home)

2. PRODUCTS (7s)
   Caption: Step 1. Categorize your products
   Sub: RevRemind sets a maintenance interval for each category. Oil filter is every 90 days.
   Screen: Products page with the category dropdown set

3. CHECKOUT (7s)
   Caption: Step 2. Customers add their vehicle at checkout
   Sub: Year, make, and model are captured automatically. No extra apps for the shopper.
   Screen: checkout with the Vehicle Information block (Year / Make / Model)

4. VEHICLES (6s)
   Caption: The vehicle is saved to the customer profile
   Sub: RevRemind links it to their order and email
   Screen: Vehicles page showing the saved 2021 Toyota Camry

5. REMINDERS - PENDING (7s)
   Caption: Step 3. RevRemind schedules the reminder
   Sub: It sends automatically at the right time. You can also send on demand.
   Screen: Reminders page, Pending tab, cursor on "Send pending reminders now"

6. SEND SUCCESS (6s)
   Caption: The reminder is sent with no errors
   Sub: Delivered from your verified RevRemind address
   Screen: green banner "1 reminder sent successfully" and the row moved to Sent

7. EMAIL RECEIVED (8s)
   Caption: Step 4. The customer gets a personalized reminder
   Sub: Written for their exact vehicle by AI
   Screen: Gmail inbox, email open. From RevRemind reminders@rev-remind.com.
   Subject "Time to check your 2021 Toyota Camry's oil filter"

8. END CARD (3s)
   RevRemind
   Set it up once. Reminders run automatically.

## Asset capture checklist (save to /screencast/assets)
- [ ] 01-dashboard.png      (embedded app home)
- [ ] 02-products.png       (category dropdown visible)
- [ ] 03-checkout.png       (vehicle capture block in checkout)
- [ ] 04-vehicles.png       (saved Toyota Camry)
- [ ] 05-reminders-pending.png (pending tab + send button)
- [ ] 06-send-success.png   (success banner)
- [ ] 07-email.png          (Gmail, email open, from rev-remind.com)

## Build
ffmpeg: per-beat scale+pad to 1920x1080 on dark brand bg, drawtext captions
(Arial), zoompan slow push-in, xfade crossfades, concat. Output screencast.mp4.

## Publish
Upload screencast.mp4 to YouTube (unlisted) or Loom. Paste URL into the Partner
feedback "Proof of resolution" box, Mark resolved, Submit fixes.
