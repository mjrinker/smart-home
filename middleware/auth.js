const { envVars } = module.parent.exports;
const { jwt } = envVars.requires;

module.exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).send({
      message: 'Unauthorized',
    });
  }

  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, trainer) => {
    if (err) {
      return res.status(403).send({
        message: 'Forbidden',
      });
    }

    req.trainer = trainer;
    return next();
  });
};
