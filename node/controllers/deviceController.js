const envVars = module.parent.exports;
const deviceHelper = require('../helpers/deviceHelper');

const { fn } = envVars;

exports.performActions = fn.asyncMw(async (req, res) => {
  const deviceActions = req.body;
  const response = await deviceHelper.performDeviceActions(deviceActions);
  return res.status(response.status).json(response);
});
