const deviceHelper = require('../helpers/deviceHelper');
const sceneHelper = require('../helpers/sceneHelper');

const {
  delay,
  fn,
  logger,
  moment,
  sequences,
} = global;

exports.playScene = fn.asyncMw(async (req, res) => {
  const sceneName = fn.slugify(req.params.sceneName);
  const response = await sceneHelper.runScene(sceneName);
  if (response && response.status) {
    return fn.sendResponse(req, res, response.status, response);
  }

  return fn.sendResponse(req, res, 200, response);
});

exports.startSequence = fn.asyncMw(async (req, res) => {
  let {
    delaySeconds, // optional, must be a number
    endAfterSeconds, // optional, must be a number
    endAtDateTime, // optional, must be a datetime string
    id, // optional, but recommended
    intervalMilliseconds, // required, must be a number
    loopCount, // optional, must be a number
    // eslint-disable-next-line prefer-const
    sequence, // required
  } = req.body;

  if (!sequence) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'MISSING_PARAM',
      message: '`sequence` is required',
    });
  }

  if (!intervalMilliseconds) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'MISSING_PARAM',
      message: '`intervalMilliseconds` is required',
    });
  }

  intervalMilliseconds = Number.parseInt(intervalMilliseconds, 10);
  if (Number.isNaN(intervalMilliseconds)) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`intervalMilliseconds` must be a number',
    });
  }

  delaySeconds = delaySeconds ? Number.parseInt(delaySeconds, 10) : null;
  if (delaySeconds && Number.isNaN(delaySeconds)) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`delaySeconds` must be a number',
    });
  }

  loopCount = loopCount ? Number.parseInt(loopCount, 10) : null;
  if (loopCount && Number.isNaN(loopCount)) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`loopCount` must be a number',
    });
  }

  endAfterSeconds = endAfterSeconds ? Number.parseInt(endAfterSeconds, 10) : null;
  if (endAfterSeconds && Number.isNaN(endAfterSeconds)) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`endAfterSeconds` must be a number',
    });
  }

  endAtDateTime = endAtDateTime ? moment(Date.parse(endAtDateTime)) : null;
  if (endAtDateTime && Number.isNaN(endAtDateTime)) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`endAtDateTime` must be a valid datetime',
    });
  }

  while (id == null) {
    id = Math.floor(Math.random() * 999999);
    if (sequences[id]) {
      id = null;
    }
  }

  if (sequences[id]) {
    const oldSequence = {
      ...sequences[id],
    };
    delete sequences[id];
    await delay(oldSequence.intervalMilliseconds);
  }

  sequences[id] = {
    delaySeconds,
    endAfterSeconds,
    endAtDateTime,
    id,
    intervalMilliseconds,
    loopCount,
    sequence,
  };

  (async () => {
    for (let i = 0; i < delaySeconds; i++) {
      if (!sequences[id]) {
        return `Sequence ${id} was cancelled`;
      }

      await delay(1000);
    }

    const endTime = endAfterSeconds == null ? null : moment().add(endAfterSeconds, 'seconds');
    let i = 0;
    while (true) { // eslint-disable-line no-constant-condition
      if (loopCount != null && i >= loopCount) {
        break;
      }
      for (let j = 0; j < sequence.length; j++) {
        if (!sequences[id]) {
          return `Sequence ${id} was cancelled`;
        }

        if ((endAtDateTime && moment().isAfter(endAtDateTime)) || (endTime && moment().isAfter(endTime))) {
          return `Sequence ${id} completed`;
        }

        const sequenceStep = sequence[j];
        if (sequenceStep?.type === 'action') {
          await deviceHelper.performDeviceActions(sequenceStep.actions);
        } else if (sequenceStep?.type === 'scene') {
          await sceneHelper.runScene(sequenceStep.sceneName);
        }
        await delay(sequenceStep?.type === 'delay' ? sequenceStep.milliseconds : intervalMilliseconds);
      }
      i += 1;
    }
    return `Sequence ${id} completed`;
  })().then((completedString) => {
    delete sequences[id];
    logger.info(completedString);
  }).catch((error) => {
    delete sequences[id];
    logger.error(`Sequence ${id} ended with error ${error}`);
  });

  const response = {
    success: true,
    status: 200,
    code: 0,
    id,
  };
  return fn.sendResponse(req, res, 200, response);
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
        message: `Sequence ${id} is required`,
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
