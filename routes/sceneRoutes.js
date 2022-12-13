const controller = require('../controllers/sceneController');

const prefix = '/scenes';

const {
  fn,
  versions,
} = global;

const routeList = [
  {
    path: '/:sceneNameOrId', // TODO change this to sceneId when <4.0.0 is removed completely
    method: 'post',
    controller: 'sceneController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '<4.0.0', func: controller.playSceneV2_0_0__V3_0_0 },
      { versions: '>=4.0.0', func: controller.playScene },
    ],
  },
  {
    path: '/sequence/start',
    method: 'post',
    controller: 'sceneController',
    auth: false, // TODO set this to true
    versions: [
      { versions: '<4.0.0', func: controller.startSequenceV2_0_0__V3_0_0 },
      { versions: '>=4.0.0', func: controller.startSequence },
    ],
  },
  {
    path: '/sequence/cancel/:id',
    method: 'delete',
    controller: 'sceneController',
    auth: false, // TODO set this to true
    versions: [
      { versions, func: controller.cancelSequence },
    ],
  },
];

fn.setRoutes({ prefix, routeList });
