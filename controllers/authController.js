const authHelper = require('../helpers/authHelper');
const constants = require('../helpers/constants');

const {
  bcrypt,
  dataFn,
  fn,
  jwt,
  models,
} = global;

const ACCESS_TOKEN_EXPIRES_IN_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN_MINUTES, 10);
const REFRESH_TOKEN_EXPIRES_IN_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, 10);

const tokenCookieOptions = {
  httpOnly: true,
  domain: 'localhost',
  path: '/',
  sameSite: 'lax',
  secure: false,
};

const accessTokenCookieOptions = {
  ...tokenCookieOptions,
  maxAge: ACCESS_TOKEN_EXPIRES_IN_MINUTES * 60 * 1000,
};

const refreshTokenCookieOptions = {
  ...tokenCookieOptions,
  maxAge: REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
};

exports.registerUser = fn.asyncMw(async (req, res) => {
  const {
    name,
    email,
    password,
  } = req.body;

  const response = await authHelper.createUser({ name, email, password });
  return fn.sendResponse(req, res, response.status || 200, response);
});

exports.login = fn.asyncMw(async (req, res) => {
  const {
    email,
    password,
  } = req.body;

  const response = await authHelper.getTokens(email, password, req.get('user-agent') || '');
  return fn.sendResponse(req, res, response.status || 200, response);
});

exports.refreshToken = fn.asyncMw(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).send({
      message: 'There was a problem refreshing your access token. Refresh token is required.',
    });
  }

  return jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send({
        message: 'There was a problem refreshing your access token.',
      });
    }

    return dataFn.findAll('Session', {
      userId: user.id,
    }).then(async (sessions) => {
      let sessionFound = false;
      for (let i = 0; i < (sessions?.length || 0); i++) {
        const session = sessions[i];
        if (await bcrypt.compare(refreshToken, session.refreshToken)) {
          sessionFound = false;
          break;
        }
      }

      if (!sessionFound) {
        return res.status(403).send({
          message: 'There was a problem refreshing your access token.',
        });
      }

      const accessToken = await authHelper.generateAccessToken(user, ACCESS_TOKEN_EXPIRES_IN_MINUTES);

      return res.send({
        expiresInSeconds: ACCESS_TOKEN_EXPIRES_IN_MINUTES * 60,
        expiresAt: authHelper.getExpiresAt(ACCESS_TOKEN_EXPIRES_IN_MINUTES),
        accessToken,
        refreshToken,
      });
    });
  });
});

exports.logout = fn.asyncMw(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).send({
      message: 'There was a problem logging out. Refresh token is required.',
    });
  }

  return jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send({
        message: 'There was a problem logging out.',
      });
    }

    return dataFn.findAll('Session', {
      userId: user.id,
    });
  }).then(async (sessions) => {
    if (sessions.length === 0) {
      return res.send({
        message: 'You have successfully logged out.',
      });
    }

    const sessionsToDelete = [];
    for (let i = 0; i < (sessions?.length || 0); i++) {
      const session = sessions[i];
      if (await bcrypt.compare(refreshToken, session.refreshToken)) {
        sessionsToDelete.push(session);
      }
    }

    if (sessionsToDelete.length === 0) {
      return res.send({
        message: 'You have successfully logged out.',
      });
    }

    try {
      await models.Session.destroy({
        where: {
          id: sessionsToDelete.map((session) => session.id),
        },
      });
    } catch (error) {
      return res.status(500).send({
        message: 'There was a problem logging out.',
        error,
      });
    }

    return res.send({
      message: 'You have successfully logged out.',
    });
  });
});

// see https://developers.google.com/assistant/smarthome/develop/implement-oauth#implement_oauth_account_linking
exports.getAuthCodeForGoogle = fn.asyncMw(async (req, res) => {
  const {
    client_id: clientId, // the client id you assigned to google
    redirect_uri: redirectUri, // the url to which you send the response to this request
    state, // a bookkeeping value that is passed back to google unchanged in the redirect uri
    // scope, // optional: a space-delimited set of scope strings that specify the data google is requesting authorization for
    response_type: responseType, // the type of value to return in the response. for the oauth 2.0 authorization code flow, the response type is always code
    // user_locale: userLocale, // the google account language setting in rfc5646 format, used to localize your content in the user's preferred language e.g. en-US
  } = req.query;

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  const googleProjectId = process.env.GOOGLE_PROJECT_ID;
  if (!googleClientId || !googleRedirectUri || !googleProjectId) {
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'AUTH_NOT_CONFIGURED',
      message: 'OAuth 2.0 not configured',
    });
  }

  // 1. verify that the client_id matches the client id you assigned to google, and that the
  //    redirect_uri matches the redirect url provided by google for your service. these checks are
  //    important to prevent granting access to unintended or misconfigured client apps. if you
  //    support multiple oauth 2.0 flows, also confirm that the response_type is code.
  if (clientId !== googleClientId || redirectUri !== googleRedirectUri) {
    return fn.sendResponse(req, res, 401, {
      success: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  }

  if (responseType !== 'code') {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'INVALID_RESPONSE_TYPE',
      message: 'An invalid response type was provided.',
    });
  }

  // 4. confirm that the url specified by the redirect_uri parameter has the following form
  //    https://oauth-redirect.googleusercontent.com/r/YOUR_PROJECT_ID
  //    https://oauth-redirect-sandbox.googleusercontent.com/r/YOUR_PROJECT_ID
  const redirectUriPattern = new RegExp(`https://oauth-redirect(?:-sandbox)?.googleusercontent.com/r/${googleProjectId}`);
  if (!redirectUriPattern.match(googleRedirectUri)) {
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'AUTH_NOT_CONFIGURED',
      message: 'OAuth 2.0 not configured',
    });
  }

  // 2. check if the user is signed in to your service. if the user isn't signed in, complete your
  //    service's sign-in or sign-up flow.
  // TODO

  // 3. generate an authorization code for google to use to access your api. the authorization code
  //    can be any string value, but it must uniquely represent the user, the client the token is
  //    for, and the code's expiration time, and it must not be guessable. you typically issue
  //    authorization codes that expire after approximately 10 minutes.
  // TODO where does the user info come from?
  const {
    authCode,
    expiresAt,
  } = await authHelper.createGoogleAuthCode(user, req.get('user-agent') || '', clientId);

  // 5. redirect the user's browser to the url specified by the redirect_uri parameter. include the
  //    authorization code you just generated and the original, unmodified state value when you
  //    redirect by appending the code and state parameters. the following is an example of the
  //    resulting url:
  //    https://oauth-redirect.googleusercontent.com/r/YOUR_PROJECT_ID?code=AUTHORIZATION_CODE&state=STATE_STRING
  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    authCode,
    expiresAt,
  })
    .redirect(301, `${redirectUri}?code=${authCode}&state=${state}`);
});

exports.getTokenForGoogle = fn.asyncMw(async (req, res) => {
  const {
    client_id: clientId, // a string that identifies the request origin as google. this string must be registered within your system as google's unique identifier
    client_secret: clientSecret, // a secret string that you registered with google for your service
    grant_type: grantType, // the type of token being exchanged. it's either authorization_code or refresh_token
    code, // when grant_type=authorization_code, this parameter is the code google received from either your sign-in or token exchange endpoint
    redirect_uri: redirectUri, // when grant_type=authorization_code, this parameter is the url used in the initial authorization request.
    refresh_token: refreshToken, // when grant_type=refresh_token, this parameter is the refresh token google received from your token exchange endpoint.
  } = req.query;

  // TODO change the below code:

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  const googleProjectId = process.env.GOOGLE_PROJECT_ID;
  if (!googleClientId || !googleRedirectUri || !googleProjectId) {
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'AUTH_NOT_CONFIGURED',
      message: 'OAuth 2.0 not configured',
    });
  }

  // 1. verify that the client_id matches the client id you assigned to google, and that the
  //    redirect_uri matches the redirect url provided by google for your service. these checks are
  //    important to prevent granting access to unintended or misconfigured client apps. if you
  //    support multiple oauth 2.0 flows, also confirm that the response_type is code.
  if (clientId !== googleClientId || redirectUri !== googleRedirectUri) {
    return fn.sendResponse(req, res, 401, {
      success: false,
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  }

  // 4. confirm that the url specified by the redirect_uri parameter has the following form
  //    https://oauth-redirect.googleusercontent.com/r/YOUR_PROJECT_ID
  //    https://oauth-redirect-sandbox.googleusercontent.com/r/YOUR_PROJECT_ID
  const redirectUriPattern = new RegExp(`https://oauth-redirect(?:-sandbox)?.googleusercontent.com/r/${googleProjectId}`);
  if (!redirectUriPattern.match(googleRedirectUri)) {
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'AUTH_NOT_CONFIGURED',
      message: 'OAuth 2.0 not configured',
    });
  }

  // 2. check if the user is signed in to your service. if the user isn't signed in, complete your
  //    service's sign-in or sign-up flow.
  // TODO

  // 3. generate an authorization code for google to use to access your api. the authorization code
  //    can be any string value, but it must uniquely represent the user, the client the token is
  //    for, and the code's expiration time, and it must not be guessable. you typically issue
  //    authorization codes that expire after approximately 10 minutes.
  // TODO
  const authorizationCode = '';
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  // 5. redirect the user's browser to the url specified by the redirect_uri parameter. include the
  //    authorization code you just generated and the original, unmodified state value when you
  //    redirect by appending the code and state parameters. the following is an example of the
  //    resulting url:
  //    https://oauth-redirect.googleusercontent.com/r/YOUR_PROJECT_ID?code=AUTHORIZATION_CODE&state=STATE_STRING
  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    authorizationCode,
    expires,
  })
    .redirect(301, `${redirectUri}`);
});

// see https://www.youtube.com/watch?v=Qt3KJZ2kQk0
exports.getOAuthForGoogle = fn.asyncMw(async (req, res) => {
  const { code } = req.query;

  const { idToken, accessToken: googleAccessToken } = await authHelper.getGoogleOAuthTokens(code);
  const googleUser = await authHelper.getGoogleUser({ idToken, accessToken: googleAccessToken });
  // you could opt to get the user by simply decoding the idToken jwt
  // const googleUser = jwt.decode(idToken);

  if (!googleUser.verifiedEmail) {
    // TODO throw 403 error
  }

  const randomPassword = authHelper.generateRandomPassword();

  const user = await authHelper.findAndUpdateUser({
    ...googleUser,
    password: randomPassword,
    authType: constants.authTypes.GOOGLE,
  });

  const {
    accessToken,
    refreshToken,
  } = await authHelper.createTokens(user, req.get('user-agent') || '');

  res.cookie('accessToken', accessToken, accessTokenCookieOptions);
  res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

  res.redirect(redirectUrl); // TODO
});
