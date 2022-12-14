const deviceHelper = require('./deviceHelper');

const {
  dataFn,
  delay,
  fn,
  logger,
  moment,
  sequences,
} = global;

exports.runScene = async (sceneId) => {
  const scene = await dataFn.findOne('Scene', { id: sceneId });
  if (!scene) {
    return {
      success: false,
      status: 404,
      error: 'SCENE_NOT_FOUND',
      message: `Cannot find scene ${sceneId}`,
    };
  }

  const sceneActions = await dataFn.findAll('SceneAction', { sceneId });
  const deviceActions = sceneActions.map((sceneAction) => ({
    model: sceneAction.model,
    id: sceneAction.modelId,
    actions: [{
      action: sceneAction.action,
      value: fn.castActionValue(sceneAction.value, sceneAction.datatype),
    }],
  })).filter((deviceAction) => deviceAction);

  return deviceHelper.performDeviceActions(deviceActions);
};

exports.runSceneByNickname = async (sceneName) => {
  const scene = await dataFn.findOne('Scene', { name: sceneName });
  if (!scene) {
    return {
      success: false,
      status: 404,
      error: 'SCENE_NOT_FOUND',
      message: `Cannot find scene ${sceneName}`,
    };
  }

  return exports.runScene(scene.id);
};

const startSequence = async ({
  delaySeconds,
  endAfterSeconds,
  endAtDateTime,
  exitSequence,
  id,
  intervalMilliseconds,
  loopCount,
  sequence,
}) => {
  if (!sequence) {
    return {
      success: false,
      status: 400,
      error: 'MISSING_PARAM',
      message: '`sequence` is required',
    };
  }

  if (!intervalMilliseconds) {
    return {
      success: false,
      status: 400,
      error: 'MISSING_PARAM',
      message: '`intervalMilliseconds` is required',
    };
  }

  const intervalMillisecondsMutable = Number.parseInt(intervalMilliseconds, 10);
  if (Number.isNaN(intervalMillisecondsMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`intervalMilliseconds` must be a number',
    };
  }

  const delaySecondsMutable = Number.parseInt(delaySeconds, 10);
  if (delaySeconds && Number.isNaN(delaySecondsMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`delaySeconds` must be a number',
    };
  }

  const loopCountMutable = Number.parseInt(loopCount, 10);
  if (loopCount && Number.isNaN(loopCountMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`loopCount` must be a number',
    };
  }

  const endAfterSecondsMutable = Number.parseInt(endAfterSeconds, 10);
  if (endAfterSeconds && Number.isNaN(endAfterSecondsMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`endAfterSeconds` must be a number',
    };
  }

  const endAtDateTimeMutable = moment(Date.parse(endAtDateTime));
  if (endAtDateTime && Number.isNaN(endAtDateTimeMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`endAtDateTime` must be a valid datetime',
    };
  }

  let idMutable = id;
  while (idMutable == null) {
    idMutable = Math.floor(Math.random() * 999999);
    if (sequences[idMutable]) {
      idMutable = null;
    }
  }

  if (sequences[idMutable]) {
    const oldSequence = {
      ...sequences[idMutable],
    };
    delete sequences[idMutable];
    await delay(oldSequence.intervalMilliseconds);
  }

  sequences[idMutable] = {
    delaySeconds: delaySecondsMutable,
    endAfterSeconds: endAfterSecondsMutable,
    endAtDateTime: endAtDateTimeMutable,
    exitSequence,
    id: idMutable,
    intervalMilliseconds: intervalMillisecondsMutable,
    loopCount: loopCountMutable,
    sequence,
  };

  (async () => {
    for (let i = 0; i < delaySecondsMutable; i++) {
      if (!sequences[id]) {
        return `Sequence ${id} was cancelled`;
      }

      await delay(1000);
    }

    const endTime = endAfterSeconds == null ? null : moment().add(endAfterSecondsMutable, 'seconds');
    let i = 0;
    while (true) { // eslint-disable-line no-constant-condition
      if (loopCount != null && i >= loopCountMutable) {
        break;
      }
      for (let j = 0; j < sequence.length; j++) {
        if (!sequences[idMutable]) {
          return `Sequence ${idMutable} was cancelled`;
        }

        if ((endAtDateTime && moment().isAfter(endAtDateTimeMutable)) || (endTime && moment().isAfter(endTime))) {
          return `Sequence ${idMutable} completed`;
        }

        const sequenceStep = sequence[j];
        if (sequenceStep?.type === 'action') {
          await deviceHelper.performDeviceActions(sequenceStep.actions);
        } else if (sequenceStep?.type === 'scene') {
          await exports.runScene(sequenceStep.sceneName);
        }
        await delay(sequenceStep.delayMilliseconds ?? intervalMillisecondsMutable);
      }
      i += 1;
    }
    return `Sequence ${idMutable} completed`;
  })().then((completedString) => {
    logger.info(completedString);
  }).catch((error) => {
    logger.error(`Sequence ${idMutable} ended with error ${error}`);
  }).finally(() => {
    delete sequences[idMutable];
    if (exitSequence) {
      startSequence({
        sequence: exitSequence,
        intervalMilliseconds: intervalMillisecondsMutable,
        loopCount: 1,
        id: `${idMutable}_EXIT`,
      });
    }
  });

  return {
    success: true,
    status: 200,
    code: 0,
    id: idMutable,
  };
};

exports.startSequence = startSequence;

const startSequenceByNickname = async ({
  delaySeconds,
  endAfterSeconds,
  endAtDateTime,
  exitSequence,
  id,
  intervalMilliseconds,
  loopCount,
  sequence,
}) => {
  if (!sequence) {
    return {
      success: false,
      status: 400,
      error: 'MISSING_PARAM',
      message: '`sequence` is required',
    };
  }

  if (!intervalMilliseconds) {
    return {
      success: false,
      status: 400,
      error: 'MISSING_PARAM',
      message: '`intervalMilliseconds` is required',
    };
  }

  const intervalMillisecondsMutable = Number.parseInt(intervalMilliseconds, 10);
  if (Number.isNaN(intervalMillisecondsMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`intervalMilliseconds` must be a number',
    };
  }

  const delaySecondsMutable = Number.parseInt(delaySeconds, 10);
  if (delaySeconds && Number.isNaN(delaySecondsMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`delaySeconds` must be a number',
    };
  }

  const loopCountMutable = Number.parseInt(loopCount, 10);
  if (loopCount && Number.isNaN(loopCountMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`loopCount` must be a number',
    };
  }

  const endAfterSecondsMutable = Number.parseInt(endAfterSeconds, 10);
  if (endAfterSeconds && Number.isNaN(endAfterSecondsMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`endAfterSeconds` must be a number',
    };
  }

  const endAtDateTimeMutable = moment(Date.parse(endAtDateTime));
  if (endAtDateTime && Number.isNaN(endAtDateTimeMutable)) {
    return {
      success: false,
      status: 400,
      error: 'BAD_PARAM',
      message: '`endAtDateTime` must be a valid datetime',
    };
  }

  let idMutable = id;
  while (idMutable == null) {
    idMutable = Math.floor(Math.random() * 999999);
    if (sequences[idMutable]) {
      idMutable = null;
    }
  }

  if (sequences[idMutable]) {
    const oldSequence = {
      ...sequences[idMutable],
    };
    delete sequences[idMutable];
    await delay(oldSequence.intervalMilliseconds);
  }

  sequences[idMutable] = {
    delaySeconds: delaySecondsMutable,
    endAfterSeconds: endAfterSecondsMutable,
    endAtDateTime: endAtDateTimeMutable,
    exitSequence,
    id: idMutable,
    intervalMilliseconds: intervalMillisecondsMutable,
    loopCount: loopCountMutable,
    sequence,
  };

  (async () => {
    for (let i = 0; i < delaySecondsMutable; i++) {
      if (!sequences[id]) {
        return `Sequence ${id} was cancelled`;
      }

      await delay(1000);
    }

    const endTime = endAfterSeconds == null ? null : moment().add(endAfterSecondsMutable, 'seconds');
    let i = 0;
    while (true) { // eslint-disable-line no-constant-condition
      if (loopCount != null && i >= loopCountMutable) {
        break;
      }
      for (let j = 0; j < sequence.length; j++) {
        if (!sequences[idMutable]) {
          return `Sequence ${idMutable} was cancelled`;
        }

        if ((endAtDateTime && moment().isAfter(endAtDateTimeMutable)) || (endTime && moment().isAfter(endTime))) {
          return `Sequence ${idMutable} completed`;
        }

        const sequenceStep = sequence[j];
        if (sequenceStep?.type === 'action') {
          await deviceHelper.performDeviceActionsByNickname(sequenceStep.actions);
        } else if (sequenceStep?.type === 'scene') {
          await exports.runSceneByNickname(sequenceStep.sceneName);
        }
        await delay(sequenceStep.delayMilliseconds ?? intervalMillisecondsMutable);
      }
      i += 1;
    }
    return `Sequence ${idMutable} completed`;
  })().then((completedString) => {
    logger.info(completedString);
  }).catch((error) => {
    logger.error(`Sequence ${idMutable} ended with error ${error}`);
  }).finally(() => {
    delete sequences[idMutable];
    if (exitSequence) {
      startSequenceByNickname({
        sequence: exitSequence,
        intervalMilliseconds: intervalMillisecondsMutable,
        loopCount: 1,
        id: `${idMutable}_EXIT`,
      });
    }
  });

  return {
    success: true,
    status: 200,
    code: 0,
    id: idMutable,
  };
};

exports.startSequenceByNickname = startSequenceByNickname;
