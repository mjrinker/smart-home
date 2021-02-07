const controller = require('../controllers/deviceController');

/* eslint-disable camelcase */
const prefixV1_0_0 = '/device';
const prefix = '/devices';
/* eslint-enable camelcase */

const {
  fn,
  versions,
} = global;

const routeList = [
  {
    prefix: prefixV1_0_0,
    path: '/action',
    method: 'post',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['1.0.0'], func: controller.performActions },
    ],
  },
  {
    path: '/action',
    method: 'post',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions, func: controller.performActions },
    ],
  },
  {
    path: '/state',
    method: 'post',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['2.1.0', '2.1.1', '3.0.0'], func: controller.getDeviceState },
    ],
  },
];

fn.setRoutes({ prefix, routeList });
