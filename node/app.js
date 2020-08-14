require('dotenv').config();

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const delay = require('delay');
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const { getSunrise, getSunset } = require('sunrise-sunset-js');
const path = require('path');
const { Sequelize, DataTypes, Model } = require('sequelize');

const _ = require('./utilities/lodash-wrapper');
const getFunctions = require('./utilities/functions');
const getDataFunctions = require('./utilities/data');

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
  const merossURL = 'localhost';
  const merossPort = process.env.MEROSS_PORT;
  const merossFullURL = `http://${merossURL}:${merossPort}`; // TODO Integrate Meross fully into node (stop using Python API)

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

  const api = new CloudTuya({
    userName: process.env.TUYA_USERNAME,
    password: process.env.TUYA_PASSWORD,
    bizType: process.env.BIZ_TYPE,
    countryCode: parseInt(process.env.COUNTRY_CODE, 10),
    region: process.env.REGION,
  });

  try {
    await api.login();
    console.log('Successfully authenticated with CloudTuya');
  } catch (error) {
    console.error('Cannot authenticate with CloudTuya');
    console.error(error);
  }

  // STEP 2: Add essential envVars
  envVars = {
    _,
    api,
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
    MerossDevice,
    merossFullURL,
    merossPort,
    merossURL,
    Model,
    path,
    sequelize,
    Thermostat,
    TuyaDevice,
    versions: ['1.0.0', '2.0.0']._sortBy(),
  };

  let fn = getFunctions(envVars);
  envVars.fn = fn;
  const dataFn = getDataFunctions(envVars);

  // STEP 3: Load and format data
  const models = dataFn.loadModels();
  const modelsBy = await dataFn.getModelsBy(models);
  const scenes = dataFn.getScenesConfig(modelsBy);
  const rooms = dataFn.getRoomsConfig(modelsBy);
  const colors = dataFn.getColorsConfig(modelsBy);
  const deviceConfig = await dataFn.getDeviceConfig(modelsBy);

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
      thermostat: Thermostat,
    },
  };

  // STEP 4: Add remaining envVars

  envVars.colors = colors;
  envVars.deviceConfig = deviceConfig;
  envVars.deviceTypeClassMap = deviceTypeClassMap;
  envVars.models = models;
  envVars.rooms = rooms;
  envVars.scenes = scenes;

  fn = getFunctions(envVars);
  envVars.fn = fn;

  module.exports = envVars;

  // STEP 5: Set routes
  app.use(cookieParser());

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json({ extended: true }));

  const routesDir = path.join(__dirname, 'routes');
  const ignoreRoutes = {};
  fs.readdir(routesDir, (err, files) => {
    files._forEach((file) => {
      if (!ignoreRoutes[file.replace(/\.js$/, '')]) {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        require(path.join(routesDir, file));
      }
    });
  });

  // STEP 6: Start server
  app.listen(port, () => console.log(`Smart Home REST Server started on port: ${port}`));
})();
