const deviceHelper = require('../helpers/deviceHelper');

const { fn } = global;

// TODO change this to pull from the db
const triggerRegexesCallbacks = {
  [/^Turn (?<actionA>(?:on|off) )?(?:the )?(?<nickname1>.*?) (?:lights? )?(?:and (?:the )?(?<nickname2>.*?) (?:lights? )?)?(?<actionB>on|off)?$/i]: (match) => (
    [match.groups.nickname1, match.groups.nickname2]
      .filter((nickname) => !!nickname)
      .map((nickname) => ({
        nickname,
        actions: [{
          action: match.groups.actionB ?? match.groups.actionA ?? 'on',
          value: true,
        }],
      }))),
  [/^Turn (?:the )?(?<nickname1>.*?) (?:lights? )?(?:and (?:the )?(?<nickname2>.*?) (?:lights? )?)?(?:(?<actionA>(?:color )?temp(?:erature)?|brightness) )?to (?<valueA>\d+)%( and (?:the )?(?:(?<actionB>(?:color )?temp(?:erature)?|brightness) )?to (?<valueB>\d+)%)?$/i]: (match) => (
    [match.groups.nickname1, match.groups.nickname2]
      .filter((nickname) => !!nickname)
      .map((nickname) => ({
        nickname,
        actions: [match.groups.actionA, match.groups.actionB].map((action, index) => ({
          action: action?.match(/(?:color )?temp(?:erature)?/i) ? 'temperature' : 'brightness',
          value: Number.parseInt(index === 0 ? match.groups.valueA : match.groups.valueB, 10),
        })),
      }))),
  [/^Turn (?:the )?(?<nickname1>.*?) (?:lights? )?(?:and (?:the )?(?<nickname2>.*?) (?:lights? )?)?(?:(?<actionA>color|brightness) )?to (?<valueA>.+?)( and (?:the )?(?:(?<actionB>color|brightness) )?to (?<valueB>.+))?$/i]: (match) => (
    [match.groups.nickname1, match.groups.nickname2]
      .filter((nickname) => !!nickname)
      .map((nickname) => ({
        nickname,
        actions: [match.groups.actionA, match.groups.actionB].map((action, index) => {
          const value = index === 0 ? match.groups.valueA : match.groups.valueB;
          return {
            action: action ?? 'brightness',
            value: action === 'color' ? value : Number.parseInt(value, 10),
          };
        }),
      }))),
  [/^Turn (?:the )?(?<nickname1>.*?) (?:lights? )?(?:and (?:the )?(?<nickname2>.*?) (?:lights? )?)?(?:(?<action>(?:color )?temp(?:erature)?|brightness) )?(?<value>up|down)$/i]: (match) => (
    [match.groups.nickname1, match.groups.nickname2]
      .filter((nickname) => !!nickname)
      .map((nickname) => ({
        nickname,
        actions: [{
          action: match.groups.action?.match(/(?:color )?temp(?:erature)?/i) ? 'temperature' : 'brightness',
          value: match.groups.value === 'up' ? '+25' : '-25',
        }],
      }))),
  [/^Turn (?<actionA>(?:on|off) )?all (?:(?:the )?lights )?(?<actionB>on|off)$/i]: (match) => [{
    nickname: '*',
    actions: [{
      action: match.groups.actionB ?? match.groups.actionA ?? 'off',
      value: true,
    }],
  }],
};

exports.triggerAction = fn.asyncMw(async (req, res) => {
  const { triggerPhrase } = req.body;
  if (!triggerPhrase) {
    return fn.sendResponse(req, res, 400, {
      success: false,
      status: 400,
      error: 'TRIGGER_PHRASE_EMPTY',
      message: 'Trigger phrase must not be empty',
    });
  }

  const triggerRegexes = Object.keys(triggerRegexesCallbacks);
  let match;
  let regex;
  for (let i = 0; i < triggerRegexes.length; i++) {
    regex = new RegExp(
      triggerRegexes[i].replaceAll(/^\/|\/\w*$/g, ''),
      triggerRegexes[i].replace(/^.*\/(\w*)$/, '$1'),
    );
    match = triggerPhrase.match(regex);
    if (match) {
      break;
    }
  }

  if (!match) {
    return fn.sendResponse(req, res, 404, {
      success: false,
      status: 404,
      error: 'TRIGGER_NOT_FOUND',
      message: `Cannot find trigger for '${triggerPhrase}'`,
    });
  }

  const deviceActions = triggerRegexesCallbacks[regex]?.(match);
  const response = await deviceHelper.performDeviceActions(deviceActions);
  return fn.sendResponse(req, res, response?.status || 200, response);
});
