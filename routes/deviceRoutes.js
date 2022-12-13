const controller = require('../controllers/deviceController');

const prefix = '/devices';

const { fn } = global;

const routeList = [
  {
    path: '/',
    method: 'get',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=4.0.0', func: controller.getDevices },
    ],
  },
  {
    path: '/action',
    method: 'post',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '<4.0.0', func: controller.performActionsV2_0_0__V3_0_0 },
      { versions: '>=4.0.0', func: controller.performActions },
    ],
  },
  {
    path: '/state',
    method: 'post',
    controller: 'deviceController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '<=2.1.0', func: controller.getDeviceState },
    ],
  },
];

fn.setRoutes({ prefix, routeList });
