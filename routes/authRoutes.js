const controller = require('../controllers/authController');

const prefix = '/auth';

const {
  fn,
  versions,
} = global;

const routeList = [
  {
    path: '/google/oauth',
    method: 'get',
    controller: 'authController',
    auth: false,
    versions: [
      { versions, func: controller.getOAuthForGoogle },
    ],
  },
  {
    path: '/google',
    method: 'post',
    controller: 'authController',
    auth: false,
    versions: [
      { versions, func: controller.getTokenForGoogle },
    ],
  },
];

fn.setRoutes({ prefix, routeList });
