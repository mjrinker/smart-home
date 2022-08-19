const controller = require('../controllers/authController');

const prefix = '/auth';

const {
  fn,
  versions,
} = global;

const routeList = [
  {
    path: '/oauth',
    method: 'get',
    controller: 'authController',
    auth: false,
    versions: [
      { versions, func: controller.getAuthCode },
    ],
  },
  {
    path: '/oauth',
    method: 'post',
    controller: 'authController',
    auth: false,
    versions: [
      { versions, func: controller.getToken },
    ],
  },
];

fn.setRoutes({ prefix, routeList });
