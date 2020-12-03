require('dotenv').config();

const _ = require('lodash');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const delay = require('delay');
const { exec } = require('child_process');
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const { getSunrise, getSunset } = require('sunrise-sunset-js');
const MerossCloud = require('meross-cloud');
const moment = require('moment-timezone');
const path = require('path');
const { Sequelize, DataTypes, Model } = require('sequelize');
const uuid = require('uuid').v4;

const {
  black,
  brightBlue,
  brightCyan,
  brightGreen,
  red,
  yellow,
} = require('ansicolors');

const getFunctions = require('./utilities/functions');
const getDataFunctions = require('./utilities/data');
const { logger, tab } = require('./utilities/logger');
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

const logout = (merossAPI) => {
  merossHelper.logout(merossAPI, (err) => {
    if (err && !(`${err.code} ${err.name}`.match(/1019|1022|1301/g))) {
      logger.error('Unable to log out of Meross', err);
      return;
    }

    logger.log('Logged out of Meross');
    process.exit();
  });
};

try {
  (async () => {
  // STEP 1: make connections
    const app = express();
    const port = process.env.PORT;
    const dbUpdateSuffix = process.env.DB_UPDATE_SUFFIX || uuid();
    const environment = process.env.ENVIRONMENT;
    const isLiveEnv = ['live', 'prod', 'production'].includes(environment);

    if (isLiveEnv) {
      setTimeout(() => {
        exec('git reset && git add sql/db_updates/*.sql && git commit -m "db updates" && git push -u origin master', (error, stdout, stderr) => {
          if (error) {
            logger.error(`git error: ${error.message}`);
            return;
          }
          if (stderr) {
            logger.error(`git stderr: ${stderr}`);
            return;
          }
          logger.error(`git stdout: ${stdout}`);
        });
      }, (moment().endOf('day').diff(moment())));
    }

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
        logging: async (string) => {
          if (isLiveEnv && !global.dbUpdateLock) {
            const sqlWithParams = string.replace(/Executing \(.*?\): /g, '');
            const isSelect = sqlWithParams.match(/^\(*\s*SELECT/i);
            const tableIsDbUpdates = sqlWithParams.match(/^\(*\s*(?:UPDATE|INSERT INTO|DELETE FROM) `?db_updates`?/i);
            const isTransaction = sqlWithParams.match(/^\(*\s*(?:START TRANSACTION|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|SET autocommit = )/i);
            if (!isSelect && !tableIsDbUpdates && !isTransaction) {
              const [sqlSafe, sqlParams] = sqlWithParams.split(/;\s*/, 2);
              let sql = sqlSafe;
              sqlParams?.split(/,\s*/).forEach((param) => {
                const formattedParam = param.replace(/^"|"$/g, "'");
                sql = sql.replace('?', formattedParam);
              });

              sql = `${sql};\n\n`;
              const dbUpdateName = `${moment().format('YYYYMMDD')}_${dbUpdateSuffix}`;
              const dbUpdateFilename = `${dbUpdateName}.sql`;
              const dbUpdateFilepath = path.join(__dirname, 'sql', 'db_updates', dbUpdateFilename);
              fs.writeFileSync(dbUpdateFilepath, sql, { flag: 'a+' });

              const transaction = await sequelize.transaction();
              try {
                await global.DBUpdate.findOrCreate({
                  where: {
                    name: dbUpdateName,
                  },
                  defaults: {
                    name: dbUpdateName,
                  },
                  transaction,
                });
                await transaction.commit();
              } catch (error) {
                await transaction.rollback();
              }
            }
          }
        },
        logQueryParameters: true,
        dialectOptions: {
          multipleStatements: true,
        },
      },
    );

    await sequelize.authenticate();

    // STEP 2: Apply DB Updates
    global.DBUpdate = sequelize.define('db_update', {
    // Model attributes are defined here
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      applied_on: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    }, {
      timestamps: true,
      createdAt: 'applied_on',
      updatedAt: false,
    });

    global.dbUpdateLock = true;

    const dbUpdates = _.keyBy(await global.DBUpdate.findAll({ raw: true }), 'name');

    const dbUpdatesDir = path.join(__dirname, 'sql', 'db_updates');
    const dbUpdateFiles = _.sortBy(fs.readdirSync(dbUpdatesDir));
    await Promise.all(dbUpdateFiles.map((filename) => (async (filename) => {
      const dbUpdateName = filename.replace(/\.sql$/, '');
      if (!dbUpdates[dbUpdateName]) {
        const sql = fs.readFileSync(path.join(dbUpdatesDir, filename), 'utf8');
        const transaction = await sequelize.transaction();
        let success = true;
        try {
          await sequelize.query(sql, { transaction });
          await global.DBUpdate.create({
            name: dbUpdateName,
          }, {
            transaction,
          });
          logger.info(`DB update ${dbUpdateName}: SUCCESS`);
        } catch (error) {
          success = false;
          await transaction.rollback();
          logger.error(`DB update ${dbUpdateName}: FAILED - ${error.message}`);
        }

        if (success) {
          await transaction.commit();
        }
      }
    })(filename)));

    global.dbUpdateLock = false;

    global.merossAPI = new MerossCloud({
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
      logger.log('Successfully authenticated with CloudTuya');
    } catch (error) {
      logger.error('Cannot authenticate with CloudTuya');
      logger.error(error);
    }

    // STEP 3: Add essential envVars
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
      logger,
      logout,
      merossAPI: global.merossAPI,
      MerossDevice,
      Model,
      moment,
      path,
      sequelize,
      tab,
      Thermostat,
      tuyaAPI,
      TuyaDevice,
      versions: _.sortBy(['1.0.0', '2.0.0', '2.1.0', '2.1.1', '3.0.0']),
    };

    let fn = getFunctions(envVars);
    envVars.fn = fn;
    const dataFn = getDataFunctions(envVars);
    envVars.dataFn = dataFn;

    // STEP 4: Load and format data
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

    global.Devices = {};
    tuyaAPI.find().then((devices) => {
      devices.forEach((device) => {
        const deviceId = device.id;
        const online = device.data?.online;
        const deviceDef = {
          bindTime: 0,
          channels: [],
          devName: device.name,
          devIconId: device.icon,
          deviceType: device.dev_type,
          domain: '',
          fmwareVersion: '',
          hdwareVersion: '',
          iconType: 0,
          onlineStatus: Number(!!online),
          region: process.env.REGION || 'us',
          reservedDomain: '',
          skillNumber: '',
          subType: device.ha_type,
          userDevIcon: '',
          uuid: deviceId,
        };

        const DeviceType = _.get(deviceTypeClassMap, ['tuya', deviceDef.deviceType], null);

        if (DeviceType) {
          global.Devices[deviceId] = {
            deviceDef,
            Device: new DeviceType({
              api: tuyaAPI,
              deviceId,
              device,
              deviceDef,
              online,
              state: device.data?.state,
            }),
          };
        } else {
          logger.error(JSON.stringify({
            level: 'ERROR',
            message: 'Cannot find matching device class',
            data: {
              deviceDef,
            },
          }));
        }
      });
    });

    // STEP 5: Initialize device listeners
    const deviceConnectionCallback = (event, deviceId, deviceDef, device) => () => {
      if (!global.Devices[deviceId]) {
        const DeviceType = _.get(deviceTypeClassMap, ['meross', deviceDef.deviceType], null);
        global.Devices[deviceId] = {
          device,
          deviceDef,
          Device: DeviceType ? new DeviceType({
            deviceId,
            device,
            deviceDef,
          }) : null,
        };
      }

      let ansiColor;
      switch (event) {
        case 'connect':
          // falls through
        case 'connected': {
          ansiColor = brightGreen;
          break;
        }
        case 'reconnect': {
          ansiColor = yellow;
          break;
        }
        case 'close': {
          ansiColor = brightBlue;
          break;
        }
        case 'error': {
          ansiColor = red;
          break;
        }
        default: {
          ansiColor = (string) => string;
        }
      }

      logger.info(deviceDef.devName, '.'.repeat(Math.abs(30 - deviceDef.devName.length)), ansiColor(event));

      if (['connect', 'connected', 'reconnect'].includes(event)) {
        device.getOnlineStatus((error, response) => {
          Date.now(); // needs just a tiny delay which this call provides
          if (global.Devices[deviceId]) {
            global.Devices[deviceId].Device.online = !!response?.online?.status;
          }
        });

        device.getSystemAllData((error, response) => {
          Date.now(); // needs just a tiny delay which this call provides
          if (global.Devices[deviceId]) {
            global.Devices[deviceId].Device.state = !!response?.all?.digest?.togglex[0]?.onoff;
            if (global.Devices[deviceId].Device instanceof Bulb) {
              const lightState = response?.all?.digest?.light;
              if (lightState) {
                global.Devices[deviceId].Device.lightValues = {
                  brightness: lightState.luminance || -1,
                  color_temp: lightState.temperature || -1,
                  color: (Number.isNaN(Number(lightState.rgb))
                    ? 0xffffff : Number(lightState.rgb)).toString(16),
                };
              }
            }
          }
        });
      } else if (['close', 'error'].includes(event) && global.Devices[deviceId]?.Device) {
        global.Devices[deviceId].Device.online = false;
        global.Devices[deviceId].Device.state = false;
      }
    };

    global.merossAPI.on('deviceInitialized', (deviceId, deviceDef, device) => {
      device.on('data', (namespace, payload) => {
        switch (namespace) {
          case 'Appliance.Control.ToggleX': {
            if (global.Devices[deviceId]) {
              global.Devices[deviceId].Device.state = !!payload?.togglex[0]?.onoff;
            }
            break;
          }
          case 'Appliance.Control.Light': {
            if (global.Devices[deviceId]) {
              global.Devices[deviceId].Device.lightValues = {
                brightness: payload?.light?.luminance || -1,
                color_temp: payload?.light?.temperature || -1,
                color: (Number.isNaN(Number(payload?.light?.rgb))
                  ? 0xffffff : Number(payload?.light?.rgb)).toString(16),
              };
            }
            break;
          }
          default: {
            break;
          }
        }
      });

      device.on('connected', deviceConnectionCallback('connected', deviceId, deviceDef, device));
      device.on('reconnect', deviceConnectionCallback('reconnect', deviceId, deviceDef, device));
      device.on('close', deviceConnectionCallback('close', deviceId, deviceDef, device));
      device.on('error', deviceConnectionCallback('error', deviceId, deviceDef, device));
    });

    global.merossAPI.connect((error) => {
      if (error) {
        logger.error(`Couldn't connect to Meross: ${error}`);
      } else {
        logger.info('Successfully authenticated with Meross');
      }
    });

    // STEP 6: Add remaining envVars

    envVars.deviceTypeClassMap = deviceTypeClassMap;

    fn = getFunctions(envVars);
    envVars.fn = fn;

    module.exports = envVars;

    // STEP 7: Set routes
    app.use(cookieParser());

    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json({ extended: true }));

    app.use(fn.asyncMw(async (req, res, next) => {
      const requestId = req.headers['X-Request-ID'] || uuid();
      req.headers['X-Request-ID'] = requestId;
      const request = {
        requestId,
        protocol: req.protocol,
        method: req.method,
        path: req.path,
        params: req.params,
        query: req.query,
        headers: req.headers,
        body: req.body,
      };
      const methods = {
        GET: brightGreen,
        POST: yellow,
        PUT: brightBlue,
        PATCH: brightCyan,
        DELETE: red,
      };
      const method = methods[req.method] ? methods[req.method](req.method) : black(req.method);
      logger.info(tab('REQUEST ', requestId, req.protocol.toUpperCase(), method, req.path, request));
      return next();
    }));

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
      logout(global.merossAPI);
    });
    process.on('SIGQUIT', () => {
      logout(global.merossAPI);
    });

    // STEP 8: Start server
    app.listen(port, () => logger.log(`Smart Home REST Server started on port: ${port}`));
  })().catch((error) => {
    if (global.merossAPI) {
      logout(global.merossAPI);
    }

    logger.error(error);
    process.exit(1);
  });
} catch (error) {
  if (global.merossAPI) {
    logout(global.merossAPI);
  }

  logger.error(error);
  process.exit(1);
}
