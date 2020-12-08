const deviceHelper = require('../helpers/deviceHelper');

const {
  fn,
  scenes,
} = global;

exports.playScene = fn.asyncMw(async (req, res) => {
  const sceneName = fn.slugify(req.params.sceneName);
  const scene = scenes[sceneName];
  if (!scene) {
    fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'SCENE_NOT_FOUND',
      message: `Cannot find scene ${sceneName}`,
    });
  }

  const deviceActions = scene.sceneActions.map((sceneAction) => {
    const sceneActionModel = sceneAction[sceneAction.model];
    const modelName = sceneActionModel.name;
    const actions = {
      [sceneAction.action]: fn.castActionValue(sceneAction.value, sceneAction.datatype),
    };

    return {
      nickname: modelName,
      actions,
    };
  });

  const response = await deviceHelper.performDeviceActions(deviceActions);
  if (response && response.status) {
    return fn.sendResponse(req, res, response.status, response);
  }

  return fn.sendResponse(req, res, 200, response);
});
