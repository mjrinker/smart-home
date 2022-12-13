const controller = require('../controllers/roomController');

const prefix = '/rooms';

const { fn } = global;

const routeList = [
  {
    path: '/',
    method: 'get',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=2.0.0,<=2.1.1', func: controller.getRoomsV2_0_0__V2_1_1 },
      { versions: '>=3.0.0', func: controller.getRooms },
    ],
  },
  {
    path: '/:roomId',
    method: 'get',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=3.0.0', func: controller.getRoom },
    ],
  },
  {
    path: '/',
    method: 'post',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=3.0.0', func: controller.createRoom },
    ],
  },
  {
    path: '/:roomId',
    method: 'put',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=3.0.0', func: controller.updateRoom },
    ],
  },
  {
    path: '/:roomId',
    method: 'delete',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=3.0.0', func: controller.deleteRoom },
    ],
  },
  {
    path: '/:roomId/alias',
    method: 'post',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=3.0.0', func: controller.addAlias },
    ],
  },
  {
    path: '/alias/:aliasId',
    method: 'delete',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=3.0.0', func: controller.removeAlias },
    ],
  },
  {
    path: '/:roomId/reassignDevices',
    method: 'put',
    controller: 'roomController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '>=3.0.0', func: controller.reassignRoomDevices },
    ],
  },
];

fn.setRoutes({ prefix, routeList });
