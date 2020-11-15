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
      { versions: ['1.0.0'], func: 'getRoomsV1_0_0' },
      { versions: ['2.0.0', '2.1.0', '2.1.1'], func: 'getRoomsV2_0_0__V2_1_1' },
      { versions: envVars.versions, func: 'getRooms' },
    ],
  },
  {
    path: '/:roomId',
    method: 'get',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['2.2.0'], func: 'getRoom' },
    ],
  },
  {
    path: '/',
    method: 'post',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['2.2.0'], func: 'createRoom' },
    ],
  },
  {
    path: '/:roomId',
    method: 'put',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['2.2.0'], func: 'updateRoom' },
    ],
  },
  {
    path: '/:roomId/reassignDevices',
    method: 'put',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: ['2.2.0'], func: 'reassignRoomDevices' },
    ],
  },
];

envVars.fn.setRoutes({
  controller, prefix, routeList,
});
