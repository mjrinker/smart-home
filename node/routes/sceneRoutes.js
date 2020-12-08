const controller = require('../controllers/sceneController');

/* eslint-disable camelcase */
const prefixV1_0_0 = '/scene';
const prefix = '/scenes';
/* eslint-enable camelcase */

const {
  fn,
  versions,
} = global;

const routeList = [
  {
    prefix: prefixV1_0_0,
    path: '/:sceneName',
    method: 'post',
    controller: 'sceneController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['1.0.0'], func: controller.playScene },
    ],
  },
  {
    path: '/:sceneName',
    method: 'post',
    controller: 'sceneController',
    auth: false, // TODO set this to true
    versions: [
      { versions, func: controller.playScene },
    ],
  },
];

fn.setRoutes({ prefix, routeList });
