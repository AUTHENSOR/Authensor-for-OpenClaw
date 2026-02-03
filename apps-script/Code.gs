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
      'Control Plane: ' + baseUrl,
      'Ingest Key: ' + ingest,
      'Executor Key: ' + executor,
      '',
      'OpenClaw config snippet:',
      '{',
      '  skills: {',
      '    entries: {',
      '      "authensor-gateway": {',
      '        enabled: true,',
      '        env: {',
      '          CONTROL_PLANE_URL: "' + baseUrl + '",',
      '          AUTHENSOR_API_KEY: "' + executor + '"',
      '        }',
      '      }',
      '    }',
      '  }',
      '}',
    ].join('\n');

    MailApp.sendEmail({
      to: email,
      subject: 'Your Authensor OpenClaw Demo Keys',
      body: body,
    });
  } catch (err) {
    Logger.log(err && err.message ? err.message : err);
  }
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
