export const auth0Config = {
  domain:      'dev-uzjcc3fqzuflvumc.us.auth0.com',
  clientId:    'uQ993w2h0v1aiXJ2k63dU6Umu9ikbMYx',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience:     'https://gravityportal-api',
  },
};

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7071/api';

export const ADMIN_EMAILS = ['ruanvz@gravitygh.co.za', 'ewan@gravitygh.co.za'];
