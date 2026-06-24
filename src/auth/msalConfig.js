export const DATAVERSE_URL = 'https://gravitytraining.api.crm4.dynamics.com/api/data/v9.2';

export const msalConfig = {
  auth: {
    clientId:    '9477b4a3-fa32-4e48-88db-fcbdf371a5cb',
    authority:   'https://login.microsoftonline.com/385f3470-aae2-44d0-8cff-1da9ffd31951',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation:        'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const dataverseScopes = [
  'https://gravitytraining.crm4.dynamics.com/user_impersonation',
];

export const mailScopes = ['https://graph.microsoft.com/Mail.Send'];

export const ADMIN_EMAILS = ['ruanvz@gravitygh.co.za', 'ewan@gravitygh.co.za'];
