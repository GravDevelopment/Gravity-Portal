const { app }          = require('@azure/functions');
const { authenticate } = require('../auth');
const { getPortalUser, getEffectivePermissions } = require('../dataverse');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

function corsHeaders(request) {
  const origin  = request.headers.get('origin') || '';
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin':  allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

app.http('portalUser', {
  methods:   ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'portal-user',

  async handler(request, context) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return { status: 204, headers: cors };
    }

    try {
      const { email } = await authenticate(request);
      const isAdmin   = ADMIN_EMAILS.includes(email);

      if (isAdmin) {
        return {
          status:  200,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            isAdmin:         true,
            canViewHome:     true,
            canViewTraining: true,
            allowedCompanies: [],
            allowedVenues:    [],
            allowedStatuses:  [],
          }),
        };
      }

      const portalUser = await getPortalUser(email);
      if (!portalUser) {
        return {
          status:  403,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ error: 'No portal access configured for this account.' }),
        };
      }

      const companyId = portalUser._crc41_portalcompany_value;
      const perms     = await getEffectivePermissions(portalUser.crc41_portaluserid, companyId);

      return {
        status:  200,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          isAdmin:         false,
          canViewHome:     perms?.crc41_canviewhome         ?? true,
          canViewTraining: perms?.crc41_canviewtrainingdata ?? true,
          allowedCompanies: perms?.crc41_companyfilter ? perms.crc41_companyfilter.split(',').map(s => s.trim()).filter(Boolean) : [],
          allowedVenues:    perms?.crc41_venuefilter   ? perms.crc41_venuefilter.split(',').map(s => s.trim()).filter(Boolean)   : [],
          allowedStatuses:  perms?.crc41_statusfilter  ? perms.crc41_statusfilter.split(',').map(s => s.trim()).filter(Boolean)  : [],
        }),
      };

    } catch (err) {
      context.error('portalUser error:', err.message);
      const status = err.message.includes('token') || err.message.includes('Token') ? 401 : 500;
      return {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ error: err.message }),
      };
    }
  },
});
