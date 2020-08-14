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
      { versions: envVars.versions, func: 'performActions' },
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
];

envVars.fn.setRoutes({
  controller, prefix, routeList,
});
