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
      { versions: envVars.versions, func: 'getRooms' },
    ],
  },
];

envVars.fn.setRoutes({
  controller, prefix, routeList,
});
