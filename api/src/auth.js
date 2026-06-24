const jwksClient = require('jwks-rsa');
const jwt        = require('jsonwebtoken');

let client = null;

function getClient() {
  if (!client) {
    client = jwksClient({
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
    });
  }
  return client;
}

function getKey(header, callback) {
  getClient().getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer:   `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

async function authenticate(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('No token provided');
  const decoded = await verifyToken(token);
  // email comes from Auth0 as sub claim or email claim
  const email = (decoded.email || decoded['https://gravityportal/email'] || '').toLowerCase();
  return { email, decoded };
}

module.exports = { authenticate };
