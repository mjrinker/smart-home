const _ = require('lodash');
const moment = require('moment-timezone');

const {
  bgBrightCyan,
  bgBrightGreen,
  bgRed,
  bgYellow,
  bgWhite,
  black,
  bold,
  brightBlack,
  brightWhite,
  fgDefault,
  red,
  steelBlue3,
  steelBlue4,
} = require('./ansicodes');

const showDebugLogs = Boolean(Number(process.env.SHOW_DEBUG_LOGS)) || (process.env.SHOW_DEBUG_LOGS || '').toLowerCase() !== 'false';

const formatLoggerMessage = (msg) => {
  if (Array.isArray(msg)) {
    return JSON.stringify(msg).replace(/\n/g, '\\n');
  }
  if (_.isPlainObject(msg)) {
    return JSON.stringify(msg).replace(/\n/g, '\\n');
  }
  if (typeof msg === 'string') {
    return msg.replace(/\n/g, '\\n');
  }
  if (msg instanceof Error) {
    return red(msg.stack.replace(/\n/g, '\\n'));
  }
  return msg;
};

const timestamp = () => moment().tz(process.env.TZ || 'UTC').format('YYYY-MM-DD HH:mm:ss.SSS z');

const timestampLog = () => (global.logOdd ? steelBlue4(`[ ${timestamp()} ]`) : steelBlue3(`[ ${timestamp()} ]`));

const getLogColor = () => (global.logOdd ? fgDefault : brightWhite);

const Logger = () => ({
  debug: async (...message) => {
    if (showDebugLogs) {
      global.logOdd = !global.logOdd;
      console.debug(bold(bgBrightCyan(brightBlack('  DEBUG  '))), timestampLog(), getLogColor()(...message.map(formatLoggerMessage)));
    }
  },
  error: async (...message) => {
    global.logOdd = !global.logOdd;
    console.error(bold(bgRed(brightWhite('  ERROR  '))), timestampLog(), getLogColor()(...message.map(formatLoggerMessage)));
  },
  info: async (...message) => {
    global.logOdd = !global.logOdd;
    console.info(bold(bgBrightGreen(brightWhite('  INFO   '))), timestampLog(), getLogColor()(...message.map(formatLoggerMessage)));
  },
  log: async (...message) => {
    global.logOdd = !global.logOdd;
    console.log(bold(bgWhite(brightWhite('  LOG    '))), timestampLog(), getLogColor()(...message.map(formatLoggerMessage)));
  },
  warn: async (...message) => {
    global.logOdd = !global.logOdd;
    console.error(bold(bgYellow(black('  WARN   '))), timestampLog(), getLogColor()(...message.map(formatLoggerMessage)));
  },
});

exports.envLogger = (arg) => {
  if ((typeof arg === 'function' && arg(process.env.ENVIRONMENT)) || arg === process.env.ENVIRONMENT) {
    return Logger();
  }
  const func = async () => {};
  return {
    debug: func,
    error: func,
    info: func,
    log: func,
    warn: func,
    env: func,
  };
};

exports.Logger = Logger;

exports.logger = Logger();

exports.tab = (...message) => message.map(formatLoggerMessage).join('    ');
