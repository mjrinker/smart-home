const { promisify } = require('util');
const constants = require('./constants');

const {
  bcrypt,
  crypto,
  dataFn,
  fetch,
  jwt,
  logger,
  models,
  sequelize,
} = global;

const ACCESS_TOKEN_EXPIRES_IN_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN_MINUTES, 10);
const REFRESH_TOKEN_EXPIRES_IN_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, 10);
const AUTH_CODE_EXPIRES_IN_MINUTES = parseInt(process.env.AUTH_CODE_EXPIRES_IN_MINUTES, 10);

const {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  AUTH_CODE_SECRET,
} = process.env;

exports.generateAccessToken = (payload, expiresInMinutes) => promisify(jwt.sign)(payload, ACCESS_TOKEN_SECRET, { expiresIn: `${expiresInMinutes}m` });

exports.generateRefreshToken = (payload, expiresInDays) => promisify(jwt.sign)(payload, REFRESH_TOKEN_SECRET, { expiresIn: `${expiresInDays}d` });

exports.generateAuthCode = (payload, expiresInMinutes) => promisify(jwt.sign)(payload, AUTH_CODE_SECRET, { expiresIn: `${expiresInMinutes}m` });

exports.generateRandomPassword = () => {
  const minPasswordLength = parseInt(process.env.MIN_PASSWORD_LENGTH, 10);
  const maxPasswordLength = Math.max(minPasswordLength + 10, 256); // this is arbitrary, there is no max length in reality
  const randomPasswordLength = Math.ceil(Math.random() * (maxPasswordLength - minPasswordLength) + minPasswordLength);
  return crypto.randomBytes(randomPasswordLength).toString('base64').slice(0, randomPasswordLength);
};

exports.getExpiresAt = (minutes) => new Date((new Date()).getTime() + (minutes * 60 * 1000));

exports.createUser = async ({
  name,
  email,
  password,
  picture,
  authType = constants.authTypes.PASSWORD,
}) => {
  if (!password || password.length < parseInt(process.env.MIN_PASSWORD_LENGTH, 10)) {
    return {
      success: false,
      status: 400,
      error: 'REGISTRATION_VALIDATION_ERROR',
      message: 'There was a problem registering. Make sure your password follows the guidelines.',
    };
  }

  if (!name) {
    return {
      success: false,
      status: 400,
      error: 'REGISTRATION_VALIDATION_ERROR',
      message: 'There was a problem registering. Name is required.',
    };
  }

  if (!email) {
    return {
      success: false,
      status: 400,
      error: 'REGISTRATION_VALIDATION_ERROR',
      message: 'There was a problem registering. Email is required.',
    };
  }

  try {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await models.User.create({
      name,
      email,
      password: hashedPassword,
      picture,
      authType,
    });

    return {
      success: true,
      status: 201,
      user,
      message: 'Thank you for registering!',
    };
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return {
        success: false,
        status: 409,
        message: 'There was a problem registering. User already exists.',
        error,
      };
    }

    logger.error(error);

    return {
      success: false,
      status: 500,
      message: 'There was a problem registering.',
      error,
    };
  }
};

exports.getTokens = async (email, password, userAgent) => {
  if (!email) {
    return {
      success: false,
      status: 401,
      error: 'AUTH_ERROR',
      message: 'There was a problem logging in. Please check to make sure your email and password are correct and try again.',
    };
  }

  const user = await dataFn.findOne('User', { email });

  if (!user) {
    return {
      success: false,
      status: 401,
      error: 'AUTH_ERROR',
      message: 'There was a problem logging in. Please check to make sure your email and password are correct and try again.',
    };
  }

  let accessToken = null;
  let refreshToken = null;

  try {
    if (!(await bcrypt.compare(password, user.password))) {
      return {
        success: false,
        status: 401,
        error: 'AUTH_ERROR',
        message: 'There was a problem logging in. Please check to make sure your email and password are correct and try again.',
      };
    }

    const tokens = await exports.createTokens(user, userAgent);
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
  } catch (error) {
    return {
      success: false,
      status: 500,
      error,
      message: 'There was a problem logging in.',
    };
  }

  if (!accessToken || !refreshToken) {
    return {
      success: false,
      status: 500,
      error: 'INTERNAL_ERROR',
      message: 'There was a problem logging in.',
    };
  }

  return {
    success: true,
    status: 200,
    expiresInSeconds: ACCESS_TOKEN_EXPIRES_IN_MINUTES * 60,
    expiresAt: exports.getExpiresAt(ACCESS_TOKEN_EXPIRES_IN_MINUTES),
    accessToken,
    refreshToken,
  };
};

exports.createTokens = async (user, userAgent) => {
  const session = await models.Session.create({
    userId: user.id,
    userAgent,
  });

  const payload = {
    ...user,
    session: session.id,
  };

  const accessToken = await exports.generateAccessToken(payload, ACCESS_TOKEN_EXPIRES_IN_MINUTES);
  const refreshToken = await exports.generateRefreshToken(payload, REFRESH_TOKEN_EXPIRES_IN_DAYS);

  const salt = await bcrypt.genSalt();
  const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);

  const transaction = await sequelize.transaction();
  const success = !!(await models.Session.update({
    refreshToken: hashedRefreshToken,
    active: true,
  }, {
    where: {
      id: session.id,
    },
    transaction,
  }))?.[0]; // TODO do something if not successful

  return {
    accessToken,
    refreshToken,
  };
};

exports.createGoogleAuthCode = async (user, userAgent, clientId) => {
  const expiresAt = (new Date(Date.now() + (AUTH_CODE_EXPIRES_IN_MINUTES * 60 * 1000))).getTime();
  const payload = {
    ...user,
    userAgent,
    clientId,
    expiresAt,
  };

  const rawAuthCode = await exports.generateRefreshToken(payload, AUTH_CODE_EXPIRES_IN_MINUTES);
  const base64EncodedAuthCode = Buffer.from(rawAuthCode).toString('base64');
  const salt = await bcrypt.genSalt();
  const hashedAuthCode = await bcrypt.hash(rawAuthCode, salt);

  await models.AuthCode.create({
    userId: user.id,
    authCode: hashedAuthCode,
    active: true,
  });

  return {
    authCode: base64EncodedAuthCode,
    expiresAt,
  };
};

exports.getGoogleOAuthTokens = async (code) => {
  const googleOAuthUrl = 'https://oauth2.googleapis.com/token';
  const queryString = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URL,
    grant_type: 'authorization_code',
  });

  let error = null;
  try {
    const response = await fetch(`${googleOAuthUrl}?${queryString}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const {
      id_token: idToken, // string
      access_token: accessToken, // string
      refresh_token: refreshToken, // string
      expires_in: expiresIn, // number
      scope, // number
    } = await response.json();

    if (!idToken || !accessToken) {
      logger.error(); // TODO
      error = new Error(); // TODO
    } else {
      return {
        idToken,
        accessToken,
        refreshToken,
        expiresIn,
        scope,
      };
    }
  } catch (err) {
    logger.error(err); // TODO
    error = new Error(err.message); // TODO
  }

  if (error) {
    throw error;
  }

  return {};
};

exports.getGoogleUser = async ({ idToken, accessToken }) => {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${accessToken}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const {
      id, // string
      email, // string
      verified_email: verifiedEmail, // boolean
      name, // string
      given_name: givenName, // string
      family_name: familyName, // string
      picture, // string
      locale, // string
    } = await response.json();

    return {
      id,
      email,
      verifiedEmail,
      name,
      givenName,
      familyName,
      picture,
      locale,
    };
  } catch (error) {
    logger.error(error); // TODO
    throw new Error(error.message); // TODO
  }
};

exports.findAndUpdateUser = async ({
  name,
  email,
  password,
  picture,
  authType,
}) => {
  const user = await dataFn.findOne('User', { email });
  if (user) {
    if (user.name !== name || user.picture !== picture) {
      const transaction = await sequelize.transaction();
      const success = !!(await models.User.update({
        name,
        picture,
        authType,
      }, {
        where: {
          id: user.id,
        },
        transaction,
      }))?.[0]; // TODO do something if not successful
    }

    return user;
  }

  return exports.createUser({
    name,
    email,
    password,
    picture,
    authType,
  });
};
