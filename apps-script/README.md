# Google Form + Apps Script Key Issuer (No Server)

This issues demo keys and emails them from your Google Workspace account (e.g. `hello@authensor.com`).

## Setup (10 minutes)
1. **Create a Google Form** with a single question: `Email`.
2. Go to **Responses → Apps Script**.
3. Paste the contents of `Code.gs` from this folder.
4. In Apps Script, open **Project Settings → Script Properties** and add:
   - `CONTROL_PLANE_URL` = `https://authensor-control-plane.onrender.com`
   - `AUTHENSOR_ADMIN_TOKEN` = `authensor_admin_...`
5. Create a trigger:
   - **Triggers → Add Trigger**
   - Choose function: `onFormSubmit`
   - Event source: `From form`
   - Event type: `On form submit`
6. Submit the form once to test.

## Notes
- The script sends email as the Google account that owns the script.
- Keep the admin token private and rotate if leaked.
- Rate limiting is built-in (one issuance per email per day).

## Customize
- Edit the email subject/body inside `Code.gs`.
