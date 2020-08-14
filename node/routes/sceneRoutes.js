const envVars = module.parent.exports;

module.exports = envVars;

const controller = require('../controllers/sceneController');

/* eslint-disable camelcase */
const prefixV1_0_0 = '/scene';
const prefix = '/scenes';
/* eslint-enable camelcase */

const routeList = [
  {
    prefix: prefixV1_0_0,
    path: '/:sceneName',
    method: 'post',
    controller: 'sceneController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['1.0.0'], func: 'playScene' },
    ],
  },
  {
    path: '/:sceneName',
    method: 'post',
    controller: 'sceneController',
    auth: false, // TODO set this to true
    versions: [
      { versions: envVars.versions, func: 'playScene' },
    ],
  },
];

envVars.fn.setRoutes({
  controller, prefix, routeList,
});
