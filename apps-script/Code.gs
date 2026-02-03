function onFormSubmit(e) {
  try {
    var email = normalizeEmail(getEmailFromEvent(e));
    if (!email) return;

    if (isRateLimited(email)) return;

    var baseUrl = getProp('CONTROL_PLANE_URL');
    var adminToken = getProp('AUTHENSOR_ADMIN_TOKEN');

    var id = shortHash(email);
    var ingest = createKey(baseUrl, adminToken, 'demo-ingest-' + id, 'ingest');
    var executor = createKey(baseUrl, adminToken, 'demo-executor-' + id, 'executor');

    var body = [
      'Your Authensor demo keys:',
      '',
      'CONTROL_PLANE_URL: ' + baseUrl,
      'EXECUTOR KEY (OpenClaw): ' + executor,
      'INGEST KEY (SDK only): ' + ingest,
      '',
      'OpenClaw setup (add to ~/.openclaw/openclaw.json):',
      'skills: { entries: { "authensor-gateway": { enabled: true, env: {',
      '  CONTROL_PLANE_URL: "' + baseUrl + '",',
      '  AUTHENSOR_API_KEY: "' + executor + '"',
      '} } } }',
      '',
      'Full setup guide: https://github.com/AUTHENSOR/Authensor-for-OpenClaw',
    ].join('\\n');

    MailApp.sendEmail({
      to: email,
      subject: 'Your Authensor OpenClaw Demo Keys',
      body: body,
    });
  } catch (err) {
    Logger.log(err && err.message ? err.message : err);
  }
}

// --- Approval emailer (slightly more secure) ---
// Setup required Script Properties:
// CONTROL_PLANE_URL, AUTHENSOR_ADMIN_TOKEN
// APPROVAL_SIGNING_SECRET (random string)
// APPROVAL_WEBAPP_URL (Apps Script Web App exec URL)
// APPROVAL_NOTIFY_EMAIL (who receives approval emails)
// Optional: APPROVAL_LINK_TTL_MINUTES (default 1440 = 24h)
// Optional: APPROVAL_EMAIL_COOLDOWN_MINUTES (default 5)

function sendApprovalEmails() {
  try {
    var baseUrl = getProp('CONTROL_PLANE_URL');
    var adminToken = getProp('AUTHENSOR_ADMIN_TOKEN');
    var notifyEmail = getProp('APPROVAL_NOTIFY_EMAIL');
    var approvalUrl = getProp('APPROVAL_WEBAPP_URL');
    var ttlMinutes = parseInt(getPropOptional('APPROVAL_LINK_TTL_MINUTES', '1440'), 10);
    var cooldownMinutes = parseInt(getPropOptional('APPROVAL_EMAIL_COOLDOWN_MINUTES', '5'), 10);

    var receipts = listPendingApprovals(baseUrl, adminToken);
    var now = Date.now();

    receipts.forEach(function (r) {
      if (!r || !r.id) return;
      if (wasRecentlyEmailed(r.id, cooldownMinutes)) return;

      var ts = now.toString();
      var approve = buildSignedLink(approvalUrl, r.id, 'approve', ts);
      var reject = buildSignedLink(approvalUrl, r.id, 'reject', ts);

      var actionType = (r.envelope && r.envelope.action && r.envelope.action.type) || 'unknown';
      var resource = (r.envelope && r.envelope.action && r.envelope.action.resource) || 'unknown';
      var principal = (r.envelope && r.envelope.principal && r.envelope.principal.id) || 'unknown';

      var body = [
        'Approval required:',
        '',
        'Action: ' + actionType,
        'Resource: ' + resource,
        'Principal: ' + principal,
        'Receipt ID: ' + r.id,
        '',
        'Approve: ' + approve,
        'Reject: ' + reject,
        '',
        'This link expires in ' + ttlMinutes + ' minutes.',
      ].join('\n');

      MailApp.sendEmail({
        to: notifyEmail,
        subject: 'Authensor approval needed',
        body: body,
      });

      markEmailed(r.id);
    });
  } catch (err) {
    Logger.log(err && err.message ? err.message : err);
  }
}

function doGet(e) {
  try {
    var rid = (e && e.parameter && e.parameter.rid) || '';
    var action = (e && e.parameter && e.parameter.action) || '';
    var ts = (e && e.parameter && e.parameter.ts) || '';
    var sig = (e && e.parameter && e.parameter.sig) || '';

    if (!rid || !action || !ts || !sig) return html('Missing parameters.');
    if (action !== 'approve' && action !== 'reject') return html('Invalid action.');

    var ttlMinutes = parseInt(getPropOptional('APPROVAL_LINK_TTL_MINUTES', '1440'), 10);
    if (!isValidSignature(rid, action, ts, sig, ttlMinutes)) {
      return html('Invalid or expired link.');
    }

    var baseUrl = getProp('CONTROL_PLANE_URL');
    var adminToken = getProp('AUTHENSOR_ADMIN_TOKEN');
    var url = baseUrl.replace(/\/$/, '') + '/approvals/' + rid + '/' + action;

    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { Authorization: 'Bearer ' + adminToken },
    });

    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      return html('Success: ' + action + 'd.');
    }
    return html('Failed: ' + res.getContentText());
  } catch (err) {
    return html(err && err.message ? err.message : 'Unknown error.');
  }
}

function listPendingApprovals(baseUrl, token) {
  var url = baseUrl.replace(/\/$/, '') + '/receipts?status=pending&decisionOutcome=require_approval&limit=50';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
  });
  var data = JSON.parse(res.getContentText());
  return (data && data.receipts) ? data.receipts : [];
}

function buildSignedLink(baseUrl, rid, action, ts) {
  var sig = signPayload(rid, action, ts);
  return baseUrl + '?rid=' + encodeURIComponent(rid) +
    '&action=' + encodeURIComponent(action) +
    '&ts=' + encodeURIComponent(ts) +
    '&sig=' + encodeURIComponent(sig);
}

function signPayload(rid, action, ts) {
  var secret = getProp('APPROVAL_SIGNING_SECRET');
  var payload = [rid, action, ts].join('|');
  var raw = Utilities.computeHmacSha256Signature(payload, secret);
  return Utilities.base64EncodeWebSafe(raw);
}

function isValidSignature(rid, action, ts, sig, ttlMinutes) {
  var tsNum = parseInt(ts, 10);
  if (!tsNum || Math.abs(Date.now() - tsNum) > ttlMinutes * 60 * 1000) return false;
  var expected = signPayload(rid, action, ts);
  return timingSafeEqual(expected, sig);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return diff === 0;
}

function wasRecentlyEmailed(receiptId, minutes) {
  var props = PropertiesService.getScriptProperties();
  var key = 'approval_sent_' + receiptId;
  var last = props.getProperty(key);
  if (!last) return false;
  return (Date.now() - Number(last)) < minutes * 60 * 1000;
}

function markEmailed(receiptId) {
  PropertiesService.getScriptProperties().setProperty('approval_sent_' + receiptId, String(Date.now()));
}

function getPropOptional(name, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  return value ? value : fallback;
}

function html(text) {
  return HtmlService.createHtmlOutput('<p>' + String(text) + '</p>');
}

function getEmailFromEvent(e) {
  if (e && e.namedValues) {
    if (e.namedValues['Email'] && e.namedValues['Email'][0]) return e.namedValues['Email'][0];
    if (e.namedValues['email'] && e.namedValues['email'][0]) return e.namedValues['email'][0];
  }
  if (e && e.values && e.values.length) return e.values[0];
  return '';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isRateLimited(email) {
  var props = PropertiesService.getScriptProperties();
  var key = 'issued_' + shortHash(email);
  var last = props.getProperty(key);
  var now = new Date().getTime();
  var dayMs = 24 * 60 * 60 * 1000;
  if (last && now - Number(last) < dayMs) return true;
  props.setProperty(key, String(now));
  return false;
}

function shortHash(value) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  var hex = raw.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  return hex.slice(0, 10);
}

function getProp(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error('Missing script property: ' + name);
  return value;
}

function createKey(baseUrl, token, name, role) {
  var url = baseUrl.replace(/\/$/, '') + '/keys';
  var payload = JSON.stringify({ name: name, role: role });
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    headers: { Authorization: 'Bearer ' + token },
  });
  var data = JSON.parse(res.getContentText());
  if (!data || !data.token) throw new Error('Key create failed');
  return data.token;
}
