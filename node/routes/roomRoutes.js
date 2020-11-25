const envVars = module.parent.exports;

module.exports = envVars;

const controller = require('../controllers/roomController');

/* eslint-disable camelcase */
const prefix = '/rooms';
/* eslint-enable camelcase */

const routeList = [
  {
    path: '/',
    method: 'get',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['1.0.0'], func: controller.getRoomsV1_0_0 },
      { versions: ['2.0.0', '2.1.0', '2.1.1'], func: controller.getRoomsV2_0_0__V2_1_1 },
      { versions: envVars.versions, func: controller.getRooms },
    ],
  },
  {
    path: '/:roomId',
    method: 'get',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['3.0.0'], func: controller.getRoom },
    ],
  },
  {
    path: '/',
    method: 'post',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['3.0.0'], func: controller.createRoom },
    ],
  },
  {
    path: '/:roomId',
    method: 'put',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['3.0.0'], func: controller.updateRoom },
    ],
  },
  {
    path: '/:roomId/reassignDevices',
    method: 'put',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['3.0.0'], func: controller.reassignRoomDevices },
    ],
  },
];

envVars.fn.setRoutes({ prefix, routeList });
