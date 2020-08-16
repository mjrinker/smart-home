const envVars = module.parent.exports;

module.exports = envVars;

const controller = require('../controllers/deviceController');

/* eslint-disable camelcase */
const prefixV1_0_0 = '/device';
const prefix = '/devices';
/* eslint-enable camelcase */

const routeList = [
  {
    prefix: prefixV1_0_0,
    path: '/action',
    method: 'post',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['1.0.0'], func: 'performActions' },
    ],
  },
  {
    path: '/action',
    method: 'post',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions: envVars.versions, func: 'performActions' },
    ],
  },
  {
    path: '/state',
    method: 'post',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['2.1.0'], func: 'getDeviceState' },
    ],
  },
];

envVars.fn.setRoutes({
  controller, prefix, routeList,
});
