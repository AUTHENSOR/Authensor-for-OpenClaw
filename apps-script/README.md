# Google Form + Apps Script Key Issuer (No Server)

This issues demo keys and emails them from your Google Workspace account (e.g. `hello@authensor.com`).

## Setup (10 minutes)
1. **Create a Google Form** with a single question: `Email`.
2. Go to **Responses → Apps Script**.
3. Paste the contents of `Code.gs` from this folder.
4. In Apps Script, open **Project Settings → Script Properties** and add:
   - `CONTROL_PLANE_URL` = `https://authensor-control-plane.onrender.com`
   - `AUTHENSOR_ADMIN_TOKEN` = `authensor_admin_...`
   - `APPROVAL_SIGNING_SECRET` = random string (keep private)
   - `APPROVAL_WEBAPP_URL` = Apps Script web app exec URL
   - `APPROVAL_NOTIFY_EMAIL` = your email address
   - `DEMO_TRIAL_DAYS` = `7` (optional)
   - `DEMO_EMAIL_ALLOWLIST` = `gmail.com,company.com` (optional)
   - `UPGRADE_URL` = `https://your-upgrade-page` (optional)
5. Create a trigger:
   - **Triggers → Add Trigger**
   - Choose function: `onFormSubmit`
   - Event source: `From form`
   - Event type: `On form submit`
6. Create a time trigger for approvals:
   - **Triggers → Add Trigger**
   - Choose function: `sendApprovalEmails`
   - Event source: `Time-driven`
   - Frequency: Every 5 minutes
7. Create a time trigger for demo key expiry:
   - **Triggers → Add Trigger**
   - Choose function: `revokeExpiredDemoKeys`
   - Event source: `Time-driven`
   - Frequency: Daily
8. Submit the form once to test.

## Notes
- The script sends email as the Google account that owns the script.
- Keep the admin token private and rotate if leaked.
- Rate limiting is built-in (one issuance per email per day).
 - Demo keys can auto-expire after `DEMO_TRIAL_DAYS` (default 7).

## Approvals (Email Links)
This script can send approval emails and handle approve/reject links.

### Deploy Web App
1. **Deploy → New deployment**
2. Select **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone with the link**
5. Copy the **Web app URL** and set it as `APPROVAL_WEBAPP_URL`

### Link Security
Links are signed with `APPROVAL_SIGNING_SECRET` and expire after 24h by default.
You can change the TTL with `APPROVAL_LINK_TTL_MINUTES`.

### Optional Tuning
- `APPROVAL_LINK_TTL_MINUTES` (default 1440)
- `APPROVAL_EMAIL_COOLDOWN_MINUTES` (default 5)
## Customize
- Edit the email subject/body inside `Code.gs`.
