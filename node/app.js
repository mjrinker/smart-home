require('dotenv').config();

const _ = require('lodash');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const delay = require('delay');
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const { getSunrise, getSunset } = require('sunrise-sunset-js');
const MerossCloud = require('meross-cloud');
const path = require('path');
const { Sequelize, DataTypes, Model } = require('sequelize');

const getFunctions = require('./utilities/functions');
const getDataFunctions = require('./utilities/data');
const merossHelper = require('./helpers/merossHelper');

const CloudTuya = require('./cloudtuya');
const TuyaDevice = require('./devices/tuya/device');
const Climate = require('./devices/tuya/climate');
const Fan = require('./devices/tuya/fan');
const Light = require('./devices/tuya/light');

const MerossDevice = require('./devices/meross/device');
const Bulb = require('./devices/meross/bulb');
const Thermostat = require('./devices/meross/thermostat');
// todo add more device classes:
// const Plug = require('./devices/meross/plug');
// const Hub = require('./devices/meross/hub');
// const Humidifier = require('./devices/meross/humidier');
// const DoorOpener = require('./devices/meross/doorOpener');
// const Sensor = require('./devices/meross/sensor');

let envVars = {};

(async () => {
  // STEP 1: make connections
  const app = express();
  const port = process.env.PORT;

  const location = {
    lat: parseFloat(process.env.LAT),
    lng: parseFloat(process.env.LNG),
    timezone: process.env.TZ,
  };

  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD, {
      host: process.env.DB_HOSTNAME,
      dialect: process.env.DB_DIALECT,
      port: process.env.DB_PORT,
      logging: false,
    },
  );

  await sequelize.authenticate();

  const merossAPI = new MerossCloud({
    email: process.env.MEROSS_USERNAME,
    password: process.env.MEROSS_PASSWORD,
    logger: () => {},
  });

  const tuyaAPI = new CloudTuya({
    userName: process.env.TUYA_USERNAME,
    password: process.env.TUYA_PASSWORD,
    bizType: process.env.BIZ_TYPE,
    countryCode: parseInt(process.env.COUNTRY_CODE, 10),
    region: process.env.REGION,
  });

  try {
    await tuyaAPI.login();
    console.log('Successfully authenticated with CloudTuya');
  } catch (error) {
    console.error('Cannot authenticate with CloudTuya');
    console.error(error);
  }

  // STEP 2: Add essential envVars
  envVars = {
    _,
    app,
    Bulb,
    Climate,
    CloudTuya,
    DataTypes,
    delay,
    express,
    Fan,
    fetch,
    fs,
    getSunrise,
    getSunset,
    Light,
    location,
    merossAPI,
    MerossDevice,
    Model,
    path,
    sequelize,
    Thermostat,
    tuyaAPI,
    TuyaDevice,
    versions: _.sortBy(['1.0.0', '2.0.0', '2.1.0', '2.1.1', '2.2.0']),
  };

  let fn = getFunctions(envVars);
  envVars.fn = fn;
  const dataFn = getDataFunctions(envVars);
  envVars.dataFn = dataFn;

  // STEP 3: Load and format data
  global.models = dataFn.loadModels();
  global.modelsBy = await dataFn.getModelsBy(global.models);
  global.scenes = dataFn.getScenesConfig(global.modelsBy);
  global.rooms = dataFn.getRoomsConfig(global.modelsBy);
  global.colors = dataFn.getColorsConfig(global.modelsBy);
  global.deviceConfig = await dataFn.getDeviceConfig(global.modelsBy);

  const deviceTypeClassMap = {
    tuya: {
      socket: TuyaDevice,
      switch: TuyaDevice,
      thermostat: Climate,
      fan: Fan,
      bulb: Light,
    },
    meross: {
      bulb: Bulb,
      msl120: Bulb,
      msl120a: Bulb,
      msl120b: Bulb,
      msl120c: Bulb,
      msl120d: Bulb,
      thermostat: Thermostat,
    },
  };

  // STEP 4: Initialize device listeners
  const Devices = {};

  merossAPI.on('deviceInitialized', (deviceId, deviceDef, device) => {
    device.on('data', (namespace, payload) => {
      switch (namespace) {
        case 'Appliance.Control.ToggleX': {
          break;
        }
        default: {
          break;
        }
      }
    });
  });

  merossAPI.on('deviceInitialized', (deviceId, deviceDef, device) => {
    device.on('connected', () => {
      const DeviceType = _.get(deviceTypeClassMap, ['meross', deviceDef.deviceType], null);
      Devices[deviceId] = {
        device,
        deviceDef,
        Device: new DeviceType({ deviceId, device, deviceDef }),
      };
    });
  });

  merossAPI.connect((error) => {
    if (error) {
      console.error(`Couldn't connect to Meross: ${error}`);
    } else {
      console.info('Successfully authenticated with Meross');
    }
  });

  // STEP 5: Add remaining envVars

  envVars.Devices = Devices;
  envVars.deviceTypeClassMap = deviceTypeClassMap;

  fn = getFunctions(envVars);
  envVars.fn = fn;

  module.exports = envVars;

  // STEP 6: Set routes
  app.use(cookieParser());

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json({ extended: true }));

  const routesDir = path.join(__dirname, 'routes');
  const ignoreRoutes = {};
  fs.readdir(routesDir, (err, files) => {
    files.forEach((file) => {
      if (!ignoreRoutes[file.replace(/\.js$/, '')]) {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        require(path.join(routesDir, file));
      }
    });
  });

  process.on('SIGINT', () => {
    merossHelper.logout(merossAPI, (err) => {
      if (err && !(`${err.code} ${err.name}`.match(/1019|1022|1301/g))) {
        console.error('Unable to log out of Meross', err);
        return;
      }

      console.log('Logged out of Meross');
      process.exit();
    });
  });

  // STEP 7: Start server
  app.listen(port, () => console.log(`Smart Home REST Server started on port: ${port}`));
})();
