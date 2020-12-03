const _ = require('lodash');
const moment = require('moment-timezone');

const {
  bgBrightCyan,
  bgBrightGreen,
  bgRed,
  bgYellow,
  bgWhite,
  black,
  brightBlack,
  brightWhite,
  white,
} = require('ansicolors');

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
  return msg;
};

exports.logger = {
  debug: async (...message) => {
    console.debug(bgBrightCyan(brightBlack('  DEBUG  ')), `[ ${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} ]`, ...message.map(formatLoggerMessage));
  },
  error: async (...message) => {
    console.error(bgRed(brightWhite('  ERROR  ')), `[ ${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} ]`, ...message.map(formatLoggerMessage));
  },
  info: async (...message) => {
    console.info(bgBrightGreen(brightBlack('  INFO   ')), `[ ${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} ]`, ...message.map(formatLoggerMessage));
  },
  log: async (...message) => {
    console.log(bgWhite(black('  LOG    ')), `[ ${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} ]`, ...message.map(formatLoggerMessage));
  },
  warn: async (...message) => {
    console.error(bgYellow(white('  WARN   ')), `[ ${moment().format('YYYY-MM-DD HH:mm:ss.SSS')} ]`, ...message.map(formatLoggerMessage));
  },
};

exports.tab = (...message) => message.map(formatLoggerMessage).join('    ');
