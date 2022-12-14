const sceneHelper = require('../helpers/sceneHelper');

const {
  fn,
  sequences,
} = global;

exports.playScene = fn.asyncMw(async (req, res) => {
  const sceneId = Number.parseInt(req.params.sceneNameOrId, 10);
  if (Number.isNaN(sceneId)) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'INVALID_sceneId',
      message: `Invalid scene ID ${sceneId}`,
    });
  }
  const response = await sceneHelper.runScene(sceneId);
  if (response && response.status) {
    return fn.sendResponse(req, res, response.status, response);
  }

  return fn.sendResponse(req, res, 200, response);
});

exports.startSequence = fn.asyncMw(async (req, res) => {
  const {
    delaySeconds, // optional, must be a number
    endAfterSeconds, // optional, must be a number
    endAtDateTime, // optional, must be a datetime string
    exitSequence, // optional
    id, // optional, but recommended
    intervalMilliseconds, // required, must be a number
    loopCount, // optional, must be a number
    sequence, // required
  } = req.body;

  const response = await sceneHelper.startSequence({
    delaySeconds,
    endAfterSeconds,
    endAtDateTime,
    exitSequence,
    id,
    intervalMilliseconds,
    loopCount,
    sequence,
  });
  return fn.sendResponse(req, res, response?.status || 200, response);
});

exports.cancelSequence = fn.asyncMw(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'MISSING_PARAM',
      message: '`id` is required',
    });
  }

  if (id === '*') {
    global.sequences = {};
  } else {
    if (!sequences[id]) {
      return fn.sendResponse(req, res, 404, {
        success: false,
        status: 404,
        error: 'NOT_FOUND',
        message: `Sequence ${id} does not exist`,
      });
    }

    delete sequences[id];
  }

  return fn.sendResponse(req, res, 200, {
    success: true,
    status: 200,
    code: 0,
    id,
  });
});

/** ******************************************************************************************* **\
 *                                          @deprecated                                          *
\* ********************************************************************************************* */

/**
 *
 * @deprecated as of version v4.0.0
 * @version v2.0.0
 * @version v2.1.0
 * @version v2.1.1
 * @version v3.0.0
 */
exports.startSequenceV2_0_0__V3_0_0 = fn.asyncMw(async (req, res) => {
  const {
    delaySeconds, // optional, must be a number
    endAfterSeconds, // optional, must be a number
    endAtDateTime, // optional, must be a datetime string
    exitSequence, // optional
    id, // optional, but recommended
    intervalMilliseconds, // required, must be a number
    loopCount, // optional, must be a number
    sequence, // required
  } = req.body;

  const response = await sceneHelper.startSequenceByNickname({
    delaySeconds,
    endAfterSeconds,
    endAtDateTime,
    exitSequence,
    id,
    intervalMilliseconds,
    loopCount,
    sequence,
  });
  return fn.sendResponse(req, res, response?.status || 200, response);
});

/**
 *
 * @deprecated as of version v4.0.0
 * @version v2.0.0
 * @version v2.1.0
 * @version v2.1.1
 * @version v3.0.0
 */
exports.playSceneV2_0_0__V3_0_0 = fn.asyncMw(async (req, res) => {
  const sceneName = fn.slugify(req.params.sceneNameOrId);
  const response = await sceneHelper.runSceneByNickname(sceneName);
  if (response && response.status) {
    return fn.sendResponse(req, res, response.status, response);
  }

  return fn.sendResponse(req, res, 200, response);
});
