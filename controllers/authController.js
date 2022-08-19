const constants = require('../helpers/constants');
const aliasHelper = require('../helpers/aliasHelper');
const deviceHelper = require('../helpers/deviceHelper');
const roomHelper = require('../helpers/roomHelper');

const {
  bcrypt,
  dataFn,
  fn,
  jwt,
  models,
  sequelize,
} = global;

exports.registerUser = fn.asyncMw(async (req, res) => {
  const {
    name,
    username,
    email,
    password,
  } = req.body;

  if (!password || password.length() < parseInt(process.env.MIN_PASSWORD_LENGTH, 10)) {
    return res.status(400).send({
      message: 'There was a problem registering. Make sure your password follows the guidelines.',
    });
  }

  if (!name) {
    return res.status(400).send({
      message: 'There was a problem registering. Name is required.',
    });
  }

  if (!username) {
    return res.status(400).send({
      message: 'There was a problem registering. Username is required.',
    });
  }

  if (!email) {
    return res.status(400).send({
      message: 'There was a problem registering. Email is required.',
    });
  }

  try {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);
    await models.User.create({
      name,
      username,
      email,
      password: hashedPassword,
    });

    return res.status(201).send({
      message: 'Thank you for registering!',
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).send({
        message: 'There was a problem registering. User already exists.',
        error,
      });
    }

    console.error(error);

    return res.status(500).send({
      message: 'There was a problem registering.',
      error,
    });
  }
});

exports.login = fn.asyncMw(async (req, res) => {
  if (!req.body.username && !req.body.email) {
    return res.status(401).send({
      message: 'There was a problem logging in. Please check to make sure your email and password are correct and try again.',
    });
  }

  const user = await models.User.findOne({
    where: {
      [Op.and]: {
        ...(req.body.email ? { email: req.body.email } : {}),
        ...(req.body.username ? { username: req.body.username } : {}),
      },
    },
    raw: true,
  });

  if (!user) {
    return res.status(401).send({
      message: 'There was a problem logging in. Please check to make sure your email and password are correct and try again.',
    });
  }

  let accessToken = null;
  let refreshToken = null;

  try {
    if (!(await bcrypt.compare(req.body.password, user.password))) {
      return res.status(401).send({
        message: 'There was a problem logging in. Please check to make sure your email and password are correct and try again.',
      });
    }

    accessToken = await generateAccessToken(user);
    refreshToken = await generateRefreshToken(user);

    const salt = await bcrypt.genSalt();
    const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);

    await models.Token.create({
      userId: user.id,
      refreshToken: hashedRefreshToken,
    });
  } catch (error) {
    return res.status(500).send({
      message: 'There was a problem logging in.',
      error,
    });
  }

  if (!accessToken || !refreshToken) {
    return res.status(500).send({
      message: 'There was a problem logging in.',
    });
  }

  return res.send({
    expiresInSeconds: expiresInMinutes * 60,
    expiresAt: getExpiresAt(expiresInMinutes),
    accessToken,
    refreshToken,
  });
});

exports.logout = fn.asyncMw(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).send({
      message: 'There was a problem logging out. Refresh token is required.',
    });
  }

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send({
        message: 'There was a problem logging out.',
      });
    }

    return models.Token.findAll({
      where: {
        userId: user.id,
      },
    });
  }).then(async (tokens) => {
    if (tokens.length === 0) {
      return res.send({
        message: 'You have successfully logged out.',
      });
    }

    const tokensToDelete = [];
    for (let i = 0; i < (tokens?.length || 0); i++) {
      const token = tokens[i];
      if (await bcrypt.compare(refreshToken, token.refreshToken)) {
        tokensToDelete.push(token);
      }
    }

    if (tokensToDelete.length === 0) {
      return res.send({
        message: 'You have successfully logged out.',
      });
    }

    try {
      await models.Token.destroy({
        where: {
          id: tokensToDelete.map((token) => token.id),
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
exports.getAuthCode = fn.asyncMw(async (req, res) => {
  const {
    client_id: clientId, // the client id you assigned to google
    redirect_uri: redirectUri, // the url to which you send the response to this request
    state, // a bookkeeping value that is passed back to google unchanged in the redirect uri
    // scope, // optional: a space-delimited set of scope strings that specify the data google is requesting authorization for
    // response_type: responseType, // the type of value to return in the response. for the oauth 2.0 authorization code flow, the response type is always code
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
    .redirect(301, `${redirectUri}?code=${authorizationCode}&state=${state}`);
});

exports.getToken = fn.asyncMw(async (req, res) => {
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
    .redirect(301, `${redirectUri}?code=${authorizationCode}&state=${state}`);
});

exports.refreshToken = fn.asyncMw(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).send({
      message: 'There was a problem refreshing your access token. Refresh token is required.',
    });
  }

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send({
        message: 'There was a problem refreshing your access token.',
      });
    }

    return models.Token.findAll({
      where: {
        userId: user.id,
      },
    }).then(async (tokens) => {
      let tokenFound = false;
      for (let i = 0; i < (tokens?.length || 0); i++) {
        const token = tokens[i];
        if (await bcrypt.compare(refreshToken, token.refreshToken)) {
          tokenFound = false;
          break;
        }
      }

      if (!tokenFound) {
        return res.status(403).send({
          message: 'There was a problem refreshing your access token.',
        });
      }

      const accessToken = await generateAccessToken(user);

      return res.send({
        expiresInSeconds: expiresInMinutes * 60,
        expiresAt: getExpiresAt(expiresInMinutes),
        accessToken,
        refreshToken,
      });
    });
  });
});

/** ******************************************************************************************* **\
 *                                  TODO remove these functions                                  *
\* ********************************************************************************************* */

exports.addAlias = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const { label, preferred } = req.body;
  const room = await dataFn.findOne('Room', { id: Number(roomId) });
  if (!room) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  const transaction = await sequelize.transaction();
  let alias;
  try {
    alias = await aliasHelper.addAlias('room', roomId, label, !!preferred, transaction);
  } catch (error) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ALIAS_NOT_CREATED',
      message: 'Cannot create alias',
    });
  }

  if (alias.error === 'EXISTS') {
    await transaction.rollback();
    return fn.sendResponse(req, res, 409, {
      success: false,
      status: 409,
      error: 'ALIAS_ALREADY_EXISTS',
      message: `Alias "${label}" for room "${room.label}" already exists`,
    });
  }

  await transaction.commit();

  return fn.sendResponse(req, res, 201, {
    success: true,
    status: 201,
    code: 0,
    room,
  });
});

exports.createRoom = fn.asyncMw(async (req, res) => {
  const { label, deviceIds } = req.body;
  const name = fn.slugify(label);
  const existingRoom = await dataFn.findOne('Room', { name });
  if (existingRoom) {
    return fn.sendResponse(req, res, 409, {
      success: false,
      status: 409,
      error: 'ROOM_ALREADY_EXISTS',
      message: `Room "${label}" already exists`,
    });
  }

  const transaction = await sequelize.transaction();
  let roomCopy;
  try {
    const room = await models.Room.create({
      name,
      label,
    }, {
      transaction,
    });

    // no await
    deviceHelper.reassignDeviceRoom(deviceIds, room.id).then(() => {
      roomHelper.updateModelsByRoomObjects({ newRoom: room.dataValues });
    });

    roomCopy = {
      ...JSON.parse(JSON.stringify(room)),
      actions: constants.roomActions,
      devices: await fn.asyncArrayIterator(deviceIds, Array.map, async (deviceId) => {
        const device = await dataFn.findOne('Device', { id: deviceId });
        return fn.filterObjectProperties(device, constants.deviceProps);
      }),
    };
  } catch (error) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ROOM_NOT_CREATED',
      message: 'Cannot create room',
    });
  }

  await transaction.commit();

  return fn.sendResponse(req, res, 201, {
    success: true,
    status: 201,
    code: 0,
    room: roomCopy,
  });
});

exports.deleteRoom = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;

  const room = await dataFn.findOne('Room', { id: Number(roomId) });
  if (!room) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  const transaction = await sequelize.transaction();
  let success;
  try {
    const deleted = await models.Room.destroy({
      where: {
        id: Number(roomId),
      },
      transaction,
    });

    success = !!deleted;

    // no await
    roomHelper.updateModelsByRoomObjects({ oldRoom: room });
  } catch (error) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ROOM_NOT_DELETED',
      message: `Cannot delete room id ${roomId}`,
    });
  }

  if (!success) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ROOM_NOT_DELETED',
      message: `Cannot delete room id ${roomId}`,
    });
  }

  await transaction.commit();
  return fn.sendResponse(req, res, 204);
});

exports.getRoom = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const room = await dataFn.findOne('Room', { id: Number(roomId) });
  if (!room) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    room,
  });
});

exports.getRooms = fn.asyncMw(async (req, res) => fn.sendResponse(req, res, 200, {
  success: true,
  status: 200,
  code: 0,
  rooms: await dataFn.findAll('Room'),
}));

exports.reassignRoomDevices = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const { deviceIds } = req.body;
  deviceHelper.reassignDeviceRoom(deviceIds, Number(roomId));
  return fn.sendResponse(req, res, 204);
});

exports.removeAlias = fn.asyncMw(async (req, res) => {
  const { aliasId } = req.params;
  const alias = await dataFn.findOne('Alias', { id: Number(aliasId) });
  if (!alias) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ALIAS_NOT_FOUND',
      message: `Cannot find alias id ${aliasId}`,
    });
  }

  const transaction = await sequelize.transaction();
  try {
    await aliasHelper.removeAlias(aliasId, transaction);
  } catch (error) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ALIAS_NOT_DELETED',
      message: `Cannot delete alias id ${aliasId}`,
    });
  }

  await transaction.commit();

  return fn.sendResponse(req, res, 204, {
    success: true,
    status: 204,
    code: 0,
  });
});

exports.updateRoom = fn.asyncMw(async (req, res) => {
  const { roomId } = req.params;
  const {
    label,
    orderBetween,
    active,
    deviceIds,
  } = req.body;

  const room = await dataFn.findOne('Room', { id: Number(roomId) });
  if (!room) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'ROOM_NOT_FOUND',
      message: `Cannot find room id ${roomId}`,
    });
  }

  let order;
  if (orderBetween) {
    const orderBetweenRooms = await dataFn.findAll('Room', { id: orderBetween });

    const orderBetweenOrders = orderBetweenRooms.map((room) => room.order);
    order = Math.round(orderBetweenOrders.reduce((a, b) => (a + b)) / orderBetweenOrders.length);
  }

  const updateObj = {
    ...(label !== undefined ? { name: fn.slugify(label) } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(active !== undefined ? { active } : {}),
  };

  const newRoom = {
    ...room,
    ...updateObj,
  };

  const transaction = await sequelize.transaction();
  let success;
  if (Object.keys(updateObj).length > 0) {
    try {
      const updated = await models.Room.update(updateObj, {
        where: {
          id: Number(roomId),
        },
        transaction,
      });

      success = !!updated[0];

      // no await
      deviceHelper.reassignDeviceRoom(deviceIds, room.id).then(() => {
        roomHelper.updateModelsByRoomObjects({ newRoom, oldRoom: room });
      });
    } catch (error) {
      await transaction.rollback();
      return fn.sendResponse(req, res, 500, {
        success: false,
        status: 500,
        error: 'ROOM_NOT_UPDATED',
        message: `Cannot update room id ${roomId}`,
      });
    }
  } else {
    success = true;
  }

  if (!success) {
    await transaction.rollback();
    return fn.sendResponse(req, res, 500, {
      success: false,
      status: 500,
      error: 'ROOM_NOT_UPDATED',
      message: `Cannot update room id ${roomId} with values ${JSON.stringify(updateObj)}`,
    });
  }

  await transaction.commit();
  return fn.sendResponse(req, res, 204);
});
