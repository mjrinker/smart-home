const envVars = module.parent.exports;
const deviceHelper = require('../helpers/deviceHelper');

const {
  fn,
} = envVars;

exports.playScene = fn.asyncMw(async (req, res) => {
  const sceneName = fn.slugify(req.params.sceneName);
  const scene = global.scenes[sceneName];
  if (!scene) {
    res.status(404).json({
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
    return res.status(response.status).json(response);
  }

  return res.json(response);
});
