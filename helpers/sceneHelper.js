const deviceHelper = require('./deviceHelper');

const {
  fn,
  scenes,
} = global;

exports.runScene = async (sceneName) => {
  const scene = scenes[sceneName];
  if (!scene) {
    return {
      success: false,
      status: 404,
      error: 'SCENE_NOT_FOUND',
      message: `Cannot find scene ${sceneName}`,
    };
  }

  const deviceActions = scene.sceneActions.map((sceneAction) => {
    const sceneActionModel = sceneAction[sceneAction.model];
    if (!sceneActionModel) {
      return null;
    }
    const modelName = sceneActionModel.name;
    const actions = {
      [sceneAction.action]: fn.castActionValue(sceneAction.value, sceneAction.datatype),
    };

    return {
      nickname: modelName,
      actions,
    };
  }).filter((deviceAction) => deviceAction);

  return deviceHelper.performDeviceActions(deviceActions);
};
