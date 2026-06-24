const fetch = require('node-fetch');

let tokenCache = null;

async function getDataverseToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.token;
  }

  const url = `https://login.microsoftonline.com/${process.env.DATAVERSE_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     process.env.DATAVERSE_CLIENT_ID,
    client_secret: process.env.DATAVERSE_CLIENT_SECRET,
    scope:         'https://gravitytraining.crm4.dynamics.com/.default',
  });

  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status} ${await res.text()}`);
  const json = await res.json();

  tokenCache = {
    token:     json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return tokenCache.token;
}

async function dvGet(path) {
  const token = await getDataverseToken();
  const headers = {
    Authorization:      `Bearer ${token}`,
    Accept:             'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version':    '4.0',
    Prefer:             'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
  };

  let url = path.startsWith('http') ? path : `${process.env.DATAVERSE_URL}/${path}`;
  const allRecords = [];

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Dataverse error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const page = json.value ?? json;
    if (Array.isArray(page)) allRecords.push(...page);
    else return page;
    url = json['@odata.nextLink'] ?? null;
  }

  return allRecords;
}

async function getPortalUser(email) {
  const encoded = encodeURIComponent(email);
  const rows = await dvGet(
    `crc41_portalusers?$select=crc41_portaluserid,_crc41_portalcompany_value,crc41_isactive&$filter=crc41_email eq '${encoded}'&$top=1`
  );
  return rows[0] ?? null;
}

async function getEffectivePermissions(portalUserId, companyId) {
  const clauses = [];
  if (companyId)    clauses.push(`_crc41_portalcompany_value eq '${companyId}'`);
  if (portalUserId) clauses.push(`_crc41_portaluser_value eq '${portalUserId}'`);
  if (!clauses.length) return null;

  const SELECT = [
    'crc41_portalpermissionid',
    'crc41_canviewhome',
    'crc41_canviewtrainingdata',
    'crc41_venuefilter',
    'crc41_statusfilter',
    'crc41_companyfilter',
    'crc41_islevel',
  ].join(',');

  const rows = await dvGet(
    `crc41_portalpermissions?$select=${SELECT}&$filter=${clauses.join(' or ')}`
  );

  const companyPerm = rows.find(p => p.crc41_islevel === 'company') ?? null;
  const userPerm    = rows.find(p => p.crc41_islevel === 'user')    ?? null;
  return userPerm ?? companyPerm ?? null;
}

const ENROLL_FIELDS = [
  'tct_enrollid',
  '_tct_student_value',
  'grav_learnerid',
  'grav_time1',
  'grav_time2',
  'tct_assessmentstatus',
  'grav_certificatenumber',
  'grav_revalidationdate',
  '_grav_course_value',
  '_tct_company_value',
  '_tct_booking_value',
].join(',');

async function getEnrollments() {
  return dvGet(`tct_enrolls?$select=${ENROLL_FIELDS}`);
}

async function getBookings() {
  return dvGet(`grav_bookings?$top=5000&$select=grav_bookingid,tct_venueselect`);
}

module.exports = { getPortalUser, getEffectivePermissions, getEnrollments, getBookings };
