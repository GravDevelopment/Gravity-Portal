const { app }                  = require('@azure/functions');
const { authenticate }         = require('../auth');
const { getPortalUser, getEffectivePermissions, getEnrollments, getBookings } = require('../dataverse');
const { mapEnrollment, applyPermissionFilters } = require('../mapper');

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

app.http('trainingRecords', {
  methods:   ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'training-records',

  async handler(request, context) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return { status: 204, headers: cors };
    }

    try {
      // 1. Verify Auth0 token
      const { email, decoded } = await authenticate(request);
      context.log('AUTH email:', email, '| sub:', decoded.sub, '| claims:', JSON.stringify(Object.keys(decoded)));
      const isAdmin   = ADMIN_EMAILS.includes(email);
      context.log('isAdmin:', isAdmin, '| ADMIN_EMAILS:', ADMIN_EMAILS);

      // 2. Fetch enrollments + bookings in parallel
      const [enrollData, bookingData] = await Promise.all([getEnrollments(), getBookings()]);

      // 3. Build booking lookup map
      const bookingMap = {};
      bookingData.forEach(b => { if (b.grav_bookingid) bookingMap[b.grav_bookingid] = b; });

      // 4. Map raw records
      let records = enrollData.map((r, i) => mapEnrollment(r, i, bookingMap));

      // 5. Apply permission filters (admins see everything)
      if (!isAdmin) {
        const portalUser = await getPortalUser(email);

        if (portalUser) {
          const companyId = portalUser._crc41_portalcompany_value;
          const perms     = await getEffectivePermissions(portalUser.crc41_portaluserid, companyId);
          records         = applyPermissionFilters(records, perms);
        } else {
          // Email not in portal users table — return nothing
          records = [];
        }
      }

      return {
        status:  200,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ records }),
      };

    } catch (err) {
      context.error('trainingRecords error:', err.message);
      const status = err.message.includes('token') || err.message.includes('Token') ? 401 : 500;
      return {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ error: err.message }),
      };
    }
  },
});
