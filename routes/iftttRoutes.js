const controller = require('../controllers/iftttController');

const prefix = '/ifttt';

const {
  fn,
  versions,
} = global;

const routeList = [
  {
    path: '/',
    method: 'post',
    controller: 'sceneController',
    auth: false, // TODO set this to true
    versions: [
      { versions, func: controller.triggerAction },
    ],
  },
];

fn.setRoutes({ prefix, routeList });
