function onFormSubmit(e) {
  try {
    var email = normalizeEmail(getEmailFromEvent(e));
    if (!email) return;

    if (isRateLimited(email)) return;
    if (!isEmailAllowed(email)) return;

    var baseUrl = getProp('CONTROL_PLANE_URL');
    var adminToken = getProp('AUTHENSOR_ADMIN_TOKEN');
    var trialDays = parseInt(getPropOptional('DEMO_TRIAL_DAYS', '7'), 10);
    var upgradeUrl = getPropOptional('UPGRADE_URL', '');

    var id = shortHash(email);
    var ingest = createKey(baseUrl, adminToken, 'demo-ingest-' + id, 'ingest');
    var executor = createKey(baseUrl, adminToken, 'demo-executor-' + id, 'executor');

    storeDemoKey(email, ingest.keyId, 'ingest');
    storeDemoKey(email, executor.keyId, 'executor');

    var bodyLines = [
      'Your Authensor demo keys:',
      '',
      'CONTROL_PLANE_URL: ' + baseUrl,
      'EXECUTOR KEY (OpenClaw): ' + executor.token,
      'INGEST KEY (SDK only): ' + ingest.token,
      '',
      'Trial: ' + trialDays + ' days (keys auto-expire).',
      '',
      'OpenClaw setup (add to ~/.openclaw/openclaw.json):',
      'skills: { entries: { "authensor-gateway": { enabled: true, env: {',
      '  CONTROL_PLANE_URL: "' + baseUrl + '",',
      '  AUTHENSOR_API_KEY: "' + executor.token + '"',
      '} } } }',
      '',
      'Full setup guide: https://github.com/AUTHENSOR/Authensor-for-OpenClaw'
    ];

    if (upgradeUrl) {
      bodyLines.push('Upgrade: ' + upgradeUrl);
    }

    var body = bodyLines.join('\\n');

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
      var allow = buildSignedLink(approvalUrl, r.id, 'allow', ts);
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
        'Approve once: ' + approve,
        'Always allow: ' + allow,
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
    if (action !== 'approve' && action !== 'reject' && action !== 'allow') return html('Invalid action.');

    var ttlMinutes = parseInt(getPropOptional('APPROVAL_LINK_TTL_MINUTES', '1440'), 10);
    if (!isValidSignature(rid, action, ts, sig, ttlMinutes)) {
      return html('Invalid or expired link.');
    }

    var baseUrl = getProp('CONTROL_PLANE_URL');
    var adminToken = getProp('AUTHENSOR_ADMIN_TOKEN');

    if (action === 'allow') {
      var receipt = getReceiptById(baseUrl, adminToken, rid);
      if (!receipt || !receipt.envelope || !receipt.envelope.action) {
        return html('Receipt not found or missing action.');
      }
      var actionType = receipt.envelope.action.type;
      var resource = receipt.envelope.action.resource;
      if (!actionType || !resource) {
        return html('Missing action type or resource.');
      }

      upsertAlwaysAllowRule(baseUrl, adminToken, actionType, resource);
      // Approve the current receipt as well
      postApproval(baseUrl, adminToken, rid, 'approve');
      return html('Success: always allow enabled and receipt approved.');
    }

    var res = postApproval(baseUrl, adminToken, rid, action);
    if (res && res.ok) {
      return html('Success: ' + action + 'd.');
    }
    return html('Failed: ' + (res && res.error ? res.error : 'Unknown error'));
  } catch (err) {
    return html(err && err.message ? err.message : 'Unknown error.');
  }
}

// --- Rate limit webhook receiver (email) ---
// Script Properties:
// RATE_LIMIT_NOTIFY_EMAIL (who receives alerts)
// Optional: RATE_LIMIT_WEBHOOK_TOKEN (shared token in webhook URL query string)
// Optional: UPGRADE_URL (included in email)

function doPost(e) {
  try {
    var expected = getPropOptional('RATE_LIMIT_WEBHOOK_TOKEN', '');
    var provided = (e && e.parameter && e.parameter.token) || '';
    if (expected && provided !== expected) return textOutput('Unauthorized');

    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    if (!raw) return textOutput('No payload');

    var payload;
    try { payload = JSON.parse(raw); } catch (err) { return textOutput('Bad JSON'); }
    if (!payload || payload.event !== 'rate_limit') return textOutput('Ignored');

    var notify = getPropOptional('RATE_LIMIT_NOTIFY_EMAIL', '');
    if (!notify) return textOutput('No notify email');

    var upgradeUrl = getPropOptional('UPGRADE_URL', '');
    var body = [
      'Authensor rate limit hit:',
      '',
      'Key: ' + (payload.keyId || 'unknown'),
      'Role: ' + (payload.role || 'unknown'),
      'Route: ' + ((payload.method || '') + ' ' + (payload.path || '')).trim(),
      'Group: ' + (payload.routeGroup || 'unknown'),
      'Limit: ' + (payload.limit || 'unknown') + ' per minute',
      'Retry after: ' + (payload.retryAfterSeconds || 'unknown') + 's',
      'Timestamp: ' + (payload.timestamp || new Date().toISOString()),
    ];

    if (upgradeUrl) {
      body.push('', 'Upgrade: ' + upgradeUrl);
    }

    MailApp.sendEmail({
      to: notify,
      subject: 'Authensor rate limit hit',
      body: body.join('\n'),
    });

    return textOutput('ok');
  } catch (err) {
    Logger.log(err && err.message ? err.message : err);
    return textOutput('error');
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

function getReceiptById(baseUrl, token, receiptId) {
  var url = baseUrl.replace(/\/$/, '') + '/receipts/' + receiptId;
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
  });
  var data = JSON.parse(res.getContentText());
  return data;
}

function postApproval(baseUrl, token, receiptId, action) {
  var url = baseUrl.replace(/\/$/, '') + '/approvals/' + receiptId + '/' + action;
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
  });
  if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) return { ok: true };
  return { ok: false, error: res.getContentText() };
}

function upsertAlwaysAllowRule(baseUrl, token, actionType, resource) {
  var active = getActivePolicy(baseUrl, token);
  var basePolicy = active && active.policy ? active.policy : null;

  if (!basePolicy) {
    basePolicy = {
      id: 'openclaw-beta-default',
      name: 'OpenClaw Beta Default Risk Policy',
      version: 'v1',
      rules: [],
      defaultEffect: 'deny'
    };
  }

  var ruleId = 'allow-' + shortHash(actionType + '|' + resource);
  var allowRule = {
    id: ruleId,
    effect: 'allow',
    description: 'Always allow ' + actionType,
    condition: {
      all: [
        { field: 'action.type', operator: 'eq', value: actionType },
        { field: 'action.resource', operator: 'eq', value: resource }
      ]
    }
  };

  var rules = basePolicy.rules || [];
  rules = rules.filter(function (r) { return r && r.id !== ruleId; });
  rules.unshift(allowRule);

  var newPolicy = JSON.parse(JSON.stringify(basePolicy));
  newPolicy.rules = rules;
  newPolicy.version = String(basePolicy.version || 'v1') + '-allow-' + String(Date.now());

  createPolicy(baseUrl, token, newPolicy);
  setActivePolicy(baseUrl, token, newPolicy.id, newPolicy.version);
}

function getActivePolicy(baseUrl, token) {
  var url = baseUrl.replace(/\/$/, '') + '/policies/active';
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      return JSON.parse(res.getContentText());
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function createPolicy(baseUrl, token, policy) {
  var url = baseUrl.replace(/\/$/, '') + '/policies';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(policy),
    headers: { Authorization: 'Bearer ' + token },
  });
}

function setActivePolicy(baseUrl, token, policyId, version) {
  var url = baseUrl.replace(/\/$/, '') + '/policies/active';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ policy_id: policyId, version: version }),
    headers: { Authorization: 'Bearer ' + token },
  });
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

// --- Demo key lifecycle ---
// Optional Script Properties:
// DEMO_TRIAL_DAYS (default 7)
// DEMO_EMAIL_ALLOWLIST (comma-separated domains, e.g. "gmail.com,example.com")
// UPGRADE_URL (link included in expiry email)

function isEmailAllowed(email) {
  var allowlist = getPropOptional('DEMO_EMAIL_ALLOWLIST', '');
  if (!allowlist) return true;
  var domain = String(email || '').split('@')[1] || '';
  var allowed = allowlist.split(',').map(function (d) { return d.trim().toLowerCase(); }).filter(Boolean);
  return allowed.indexOf(domain.toLowerCase()) !== -1;
}

function storeDemoKey(email, keyId, role) {
  if (!keyId) return;
  var props = PropertiesService.getScriptProperties();
  var payload = {
    email: email,
    keyId: keyId,
    role: role,
    issuedAt: Date.now(),
    revoked: false
  };
  props.setProperty('demo_key_' + keyId, JSON.stringify(payload));
}

function revokeExpiredDemoKeys() {
  try {
    var baseUrl = getProp('CONTROL_PLANE_URL');
    var adminToken = getProp('AUTHENSOR_ADMIN_TOKEN');
    var trialDays = parseInt(getPropOptional('DEMO_TRIAL_DAYS', '7'), 10);
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties();
    var now = Date.now();
    var cutoffMs = trialDays * 24 * 60 * 60 * 1000;

    Object.keys(all).forEach(function (key) {
      if (key.indexOf('demo_key_') !== 0) return;
      var data;
      try { data = JSON.parse(all[key]); } catch { return; }
      if (!data || data.revoked) return;
      if (!data.issuedAt || (now - Number(data.issuedAt) < cutoffMs)) return;

      revokeKeyById(baseUrl, adminToken, data.keyId);
      data.revoked = true;
      props.setProperty(key, JSON.stringify(data));

      if (!wasUpgradeSent(data.email)) {
        sendUpgradeEmail(data.email, trialDays);
        markUpgradeSent(data.email);
      }
    });
  } catch (err) {
    Logger.log(err && err.message ? err.message : err);
  }
}

function revokeKeyById(baseUrl, token, keyId) {
  if (!keyId) return;
  var url = baseUrl.replace(/\/$/, '') + '/keys/' + keyId + '/revoke';
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
  });
}

function wasUpgradeSent(email) {
  if (!email) return false;
  var props = PropertiesService.getScriptProperties();
  return !!props.getProperty('upgrade_sent_' + shortHash(email));
}

function markUpgradeSent(email) {
  if (!email) return;
  PropertiesService.getScriptProperties().setProperty('upgrade_sent_' + shortHash(email), String(Date.now()));
}

function sendUpgradeEmail(email, trialDays) {
  if (!email) return;
  var upgradeUrl = getPropOptional('UPGRADE_URL', '');
  var body = [
    'Your Authensor demo key has expired.',
    '',
    'Trial length: ' + trialDays + ' days.',
    'Upgrade to keep protections and unlock higher limits, custom policies, and longer retention.',
    '',
    upgradeUrl ? ('Upgrade: ' + upgradeUrl) : 'Reply to this email to upgrade.'
  ].join('\\n');

  MailApp.sendEmail({
    to: email,
    subject: 'Your Authensor demo has ended',
    body: body,
  });
}

function getPropOptional(name, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  return value ? value : fallback;
}

function html(text) {
  return HtmlService.createHtmlOutput('<p>' + String(text) + '</p>');
}

function textOutput(text) {
  return ContentService.createTextOutput(String(text));
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
  return { token: data.token, keyId: data.keyId, createdAt: data.createdAt };
}
