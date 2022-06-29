const sceneHelper = require('../helpers/sceneHelper');

const { fn } = global;

exports.playScene = fn.asyncMw(async (req, res) => {
  const sceneName = fn.slugify(req.params.sceneName);
  const response = await sceneHelper.runScene(sceneName);
  if (response && response.status) {
    return fn.sendResponse(req, res, response.status, response);
  }

  return fn.sendResponse(req, res, 200, response);
});
