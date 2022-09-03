require('dotenv').config();

const _ = require('lodash');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const delay = require('delay');
const { exec } = require('child_process');
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const {
  getSunrise: getSunriseOriginal,
  getSunset: getSunsetOriginal,
} = require('sunrise-sunset-js');
const isReachable = require('is-reachable');
const MerossCloud = require('meross-cloud');
const moment = require('moment-timezone');
const path = require('path');
const {
  ConnectionError,
  ConnectionTimedOutError,
  DataTypes,
  Model,
  Op,
  Sequelize,
  TimeoutError, cast,
} = require('sequelize');
const uuid = require('uuid').v4;

const {
  black,
  brightBlue,
  brightCyan,
  brightGreen,
  red,
  yellow,
} = require('./utilities/ansicodes');

const getFunctions = require('./utilities/functions');
const getDataFunctions = require('./utilities/data');
const { envLogger, Logger, tab } = require('./utilities/logger');
const merossHelper = require('./helpers/merossHelper');

const CloudTuya = require('./cloudtuya');
const TuyaDevice = require('./devices/tuya/device');
const Climate = require('./devices/tuya/climate');
const Fan = require('./devices/tuya/fan');
const Light = require('./devices/tuya/light');

const MQTTClient = require('./lib/mqtt/MQTTClient');
const MerossLocalDevice = require('./lib/meross-local/MerossLocalDevice');
const MerossDevice = require('./devices/meross/device');
const Bulb = require('./devices/meross/bulb');
const Thermostat = require('./devices/meross/thermostat');
const Plug = require('./devices/meross/plug');
// TODO add more device classes:
// const Hub = require('./devices/meross/hub');
// const Humidifier = require('./devices/meross/humidifier');
// const DoorOpener = require('./devices/meross/doorOpener');
// const Sensor = require('./devices/meross/sensor');

// require('./broker/mqttBroker');

const logger = {
  ...(Logger()),
  live: envLogger((env) => ['live', 'prod', 'production'].includes(env)),
  stg: envLogger((env) => ['stg', 'stage', 'staging'].includes(env)),
  uat: envLogger((env) => ['uat', 'test', 'testing', 'beta'].includes(env)),
  dev: envLogger((env) => ['dev', 'develop', 'development', 'local', 'alpha'].includes(env)),
};

logger.dev.debug('Debug log works!');
logger.dev.error('Error log works!');
logger.dev.info('Info log works!');
logger.dev.log('Log works!');
logger.dev.warn('Warning log works!');

const getSunrise = getSunriseOriginal;
const getSunset = (latitude, longitude, date) => {
  const sunsetDate = getSunsetOriginal(latitude, longitude, date);
  if (sunsetDate.getDate() === date.getDate()) {
    return sunsetDate;
  }

  date.setDate(date.getDate() - (sunsetDate.getDate() - date.getDate()));
  return getSunsetOriginal(latitude, longitude, date);
};

const logout = (merossAPI) => {
  if (merossAPI) {
    merossHelper.logout(merossAPI, (err) => {
      if (err && !(`${err.code} ${err.name}`.match(/1019|1022|1301/g))) {
        logger.error('Unable to log out of Meross', err);
        process.exit();
        return;
      }

      logger.info('Logged out of Meross');
      process.exit();
    });
  } else {
    process.exit();
  }
};

try {
  (async () => {
    let hasInternetConnection = false;
    while (!hasInternetConnection && process.env.AWAIT_INTERNET_CONNECTION?.toLowerCase() === 'true') {
      hasInternetConnection = await isReachable('google.com:443');
      if (!hasInternetConnection) {
        await logger.warn('Internet not connected, checking again in 15 seconds...');
        await delay(15000);
      }
    }

    const app = express();
    const port = process.env.PORT;
    const dbUpdateSuffix = process.env.DB_UPDATE_SUFFIX || uuid();
    const environment = process.env.ENVIRONMENT;
    const isLiveEnv = ['live', 'prod', 'production'].includes(environment);

    if (isLiveEnv) {
      // at the end of the day, commit any db updates from production to vcs
      setTimeout(() => {
        exec(
          'git reset && git add sql/db_updates/*.sql && git commit -m "db updates" && git push -u origin master',
          (error, stdout, stderr) => {
            if (error) {
              logger.error(`git error: ${error.message}`);
              return;
            }
            if (stderr) {
              logger.error(`git stderr: ${stderr}`);
              return;
            }
            logger.error(`git stdout: ${stdout}`);
          },
        );
      }, (moment().endOf('day').diff(moment())));
    }

    const geoLocation = {
      lat: parseFloat(process.env.LAT),
      lng: parseFloat(process.env.LNG),
      timezone: process.env.TZ,
    };

    // connect to database
    const sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USERNAME,
      process.env.DB_PASSWORD, {
        host: process.env.DB_HOSTNAME,
        dialect: process.env.DB_DIALECT,
        port: process.env.DB_PORT,
        logging: async (...msg) => {
          const messages = msg.filter((message) => !_.isPlainObject(message));
          await logger.debug(...messages);
          if (isLiveEnv && !global.dbUpdateLock) {
            const sqlWithParams = msg[0].replace(/Executing \(.*?\): /g, '');
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

              const dbUpdateDirPath = path.join(__dirname, 'sql', 'db_updates');
              const dbUpdateFilenames = fs.readdirSync(dbUpdateDirPath);

              const dbUpdateNameRegExp = new RegExp(`^${moment().tz(process.env.TZ || 'UTC').format('YYYYMMDD')}\\d{6}_${dbUpdateSuffix}`);
              const dbUpdateNameMatch = _.find(dbUpdateFilenames, (filename) => (
                filename.match(dbUpdateNameRegExp)
              ));

              let dbUpdateName;
              if (dbUpdateNameMatch) {
                dbUpdateName = dbUpdateNameMatch.replace(/\.sql$/, '');
              } else {
                dbUpdateName = `${moment().tz(process.env.TZ || 'UTC').format('YYYYMMDDHHmmss')}_${dbUpdateSuffix}`;
              }

              const dbUpdateFilename = `${dbUpdateName}.sql`;
              const dbUpdateFilepath = path.join(dbUpdateDirPath, dbUpdateFilename);
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
        retry: {
          match: [
            ConnectionError,
            ConnectionTimedOutError,
            TimeoutError,
            /Lock wait timeout exceeded/i,
          ],
          max: 3,
        },
      },
    );

    await sequelize.authenticate();

    // apply db Updates
    global.DBUpdate = sequelize.define('db_update', {
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
    await (dbUpdateFiles.map((filename) => async () => {
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
    })).reduce((p, func) => p.then(func), Promise.resolve());

    global.dbUpdateLock = false;

    // initialize meross connection
    global.merossAPI = new MerossCloud({
      email: process.env.MEROSS_USERNAME,
      password: process.env.MEROSS_PASSWORD,
      logger: () => {},
    });

    // initialize tuya connection
    const tuyaAPI = new CloudTuya({
      userName: process.env.TUYA_USERNAME,
      password: process.env.TUYA_PASSWORD,
      bizType: process.env.BIZ_TYPE,
      countryCode: parseInt(process.env.COUNTRY_CODE, 10),
      region: process.env.REGION,
    });

    // add essential globals
    const globals = {
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
      geoLocation,
      getSunrise,
      getSunset,
      isReachable,
      Light,
      logger,
      logout,
      MerossDevice,
      Model,
      moment,
      Op,
      path,
      sequelize,
      sequences: {},
      tab,
      Thermostat,
      tuyaAPI,
      TuyaDevice,
      versions: _.sortBy(['1.0.0', '2.0.0', '2.1.0', '2.1.1', '3.0.0']),
    };

    Object.entries(globals).forEach(([key, value]) => {
      global[key] = value;
    });

    let fn = getFunctions();
    global.fn = fn;
    const dataFn = getDataFunctions();
    global.dataFn = dataFn;

    // load data
    global.models = dataFn.loadModels();
    global.data = await dataFn.getData(global.models);

    global.Devices = {};

    global.deviceTypeClassMap = {
      tuya: {
        socket: TuyaDevice,
        switch: TuyaDevice,
        thermostat: Climate,
        fan: Fan,
        bulb: Light,
        __ignore: ['scene'],
      },
      meross: {
        bulb: Bulb,
        msl100: Bulb,
        msl120: Bulb,
        msl120a: Bulb,
        msl120b: Bulb,
        msl120c: Bulb,
        msl120d: Bulb,
        thermostat: Thermostat,
        mts100: Thermostat,
        mts150: Thermostat,
        mts200: Thermostat,
        plug: Plug,
        mss110: Plug,
        mss210: Plug,
        mss310: Plug,
        mss120: Plug,
        mss620: Plug,
        mss630: Plug,
      },
    };

    // connect to tuya and discover devices
    const tuyaDevices = await dataFn.findAll('Device', { platform: 'tuya' });
    tuyaAPI.login().then(() => {
      logger.info('Successfully authenticated with CloudTuya');
      tuyaAPI.find({}).then((devices) => {
        devices.forEach(({
          data: {
            online,
            state,
          },
          name,
          icon,
          id,
          /* eslint-disable camelcase */
          dev_type,
          ha_type,
          /* eslint-enable camelcase */
        }) => {
          // eslint-disable-next-line camelcase
          const savedDevice = tuyaDevices.find(({ mfg_id }) => mfg_id === id);
          const deviceId = id;
          const deviceDef = {
            uuid: deviceId,
            onlineStatus: Number(!!online),
            devName: name,
            devIconId: icon,
            userDevIcon: savedDevice?.type,
            iconType: 1,
            deviceType: dev_type,
            subType: ha_type,
            fmwareVersion: savedDevice?.firmware_version,
            hdwareVersion: savedDevice?.hardware_version,
            skillNumber: '1',
            region: process.env.REGION || 'us',
            domain: `https://px1.tuya${process.env.REGION || 'us'}.com/`,
            reservedDomain: `https://px1.tuya${process.env.REGION || 'us'}.com/`,
            bindTime: 12,
            channels: [0],
          };
          if (global.deviceTypeClassMap.tuya.__ignore.includes(deviceDef.deviceType)) {
            logger.dev.warn(`Ignoring device class for Tuya ${deviceDef.deviceType} ${deviceDef.devName}`);
          } else {
            const DeviceType = global.deviceTypeClassMap?.tuya?.[deviceDef.deviceType];
            if (DeviceType) {
              global.Devices[deviceId] = {
                deviceDef,
                Device: new DeviceType({
                  api: tuyaAPI,
                  deviceId,
                  device: {
                    data: {
                      online,
                      state,
                    },
                    name,
                    icon,
                    id,
                    dev_type,
                    ha_type,
                  },
                  deviceDef,
                  online,
                  state,
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
          }
        });
      });
    }).catch((error) => {
      logger.error('Cannot authenticate with CloudTuya');
      logger.error(error);
    });

    // connect to meross and discover devices
    merossHelper.listeners();
    global.merossAPI.connect((error) => {
      if (error) {
        logger.error(`Couldn't connect to Meross: ${error}`);
      } else {
        logger.info('Successfully authenticated with Meross');
      }
    });

    const merossLocalDevices = (await dataFn.findAll('Device', { platform: 'meross_local' }));

    // connect to local meross devices
    merossLocalDevices.forEach((savedDevice) => {
      const deviceDef = {
        uuid: savedDevice.mfg_id,
        onlineStatus: 1,
        devName: savedDevice.label,
        devIconId: savedDevice.type,
        userDevIcon: savedDevice.type,
        iconType: 1,
        deviceType: savedDevice.mfg_model,
        subType: savedDevice.mfg_sub_model,
        fmwareVersion: savedDevice.firmware_version,
        hdwareVersion: savedDevice.hardware_version,
        skillNumber: '2',
        region: process.env.REGION,
        domain: '192.168.0.107',
        reservedDomain: '192.168.0.107',
        bindTime: 12,
        channels: [0],
      };

      const device = new MerossLocalDevice('token', '', '0', deviceDef, logger);
      if (savedDevice.name.startsWith('office')) device.connect(); // FIXME don't commit this
      global.Devices[deviceDef.uuid] = {
        device,
        deviceDef,
        Device: new Bulb({
          deviceId: deviceDef.uuid,
          device,
          deviceDef,
        }),
      };
      global.Devices[deviceDef.uuid].Device.isOn().then((state) => {
        global.Devices[deviceDef.uuid].Device.state = state;
      });
    });

    global.deviceLinkActions = {};
    global.debounces = {};

    // TODO add a table for this to the database
    const linkedDevices = [
      {
        topic: 'stat/tasmota_C013CD/POWER',
        nickname: 'office',
        messageDataType: 'string',
        actionDataType: 'string',
        actionPath: '$',
        defaultActionDataType: 'string',
        defaultAction: 'toggle',
        defaultActionDataTypeIfNoValue: 'string',
        actionPathIfNoValue: '$',
        defaultActionIfNoValue: 'toggle',
        valuePath: null,
        valueDataType: 'boolean',
        defaultValueDataType: 'boolean',
        defaultValue: 'true',
      },
      {
        topic: 'stat/tasmota_C013CD/RESULT',
        nickname: 'office',
        messageDataType: 'json',
        actionDataType: 'string',
        actionPath: null,
        defaultActionDataType: 'string',
        defaultAction: 'brightness',
        defaultActionDataTypeIfNoValue: 'string',
        actionPathIfNoValue: '$.POWER',
        defaultActionIfNoValue: 'toggle',
        valuePath: '$.Dimmer',
        valueDataType: 'number',
        defaultValueDataType: 'boolean',
        defaultValue: 'true',
      },
    ];

    const deviceLinks = Object.fromEntries(linkedDevices.map(({
      topic,
      nickname,
      messageDataType,
      actionDataType,
      actionPath,
      defaultActionDataType,
      defaultAction,
      defaultActionDataTypeIfNoValue,
      actionPathIfNoValue,
      defaultActionIfNoValue,
      valuePath,
      valueDataType,
      defaultValueDataType,
      defaultValue,
    }) => [topic, {
      nickname,
      actionTranslator: (message) => {
        let castMessage = message;
        if (message) {
          switch (messageDataType) {
            case 'json': {
              try {
                castMessage = JSON.parse(message);
              } catch (e) {
                castMessage = message;
              }
              break;
            }
            case 'string':
            default: {
              castMessage = message;
            }
          }
        }

        let value;
        let originalValue;
        let valueDataTypeToUse;
        if (typeof castMessage === 'object') {
          originalValue = valuePath ? _.get(castMessage, valuePath.replace(/^\$\./, '')) : defaultValue;
          valueDataTypeToUse = valuePath ? valueDataType : defaultValueDataType;
          if (originalValue) {
            value = originalValue;
            valueDataTypeToUse = valuePath ? valueDataType : defaultValueDataType;
          } else {
            value = defaultValue;
            valueDataTypeToUse = defaultValueDataType;
          }
        } else {
          originalValue = castMessage;
          if (originalValue) {
            value = originalValue;
            valueDataTypeToUse = valueDataType;
          } else {
            value = defaultValue;
            valueDataTypeToUse = defaultValueDataType;
          }
        }

        if (value) {
          switch (valueDataTypeToUse) {
            case 'null': {
              value = null;
              break;
            }
            case 'boolean': {
              if (typeof value !== 'boolean') {
                value = value === 'true';
              }
              break;
            }
            case 'number': {
              if (typeof value !== 'number') {
                value = Number.parseFloat(value ? value.replaceAll(/\D/g, '') : defaultValue);
                value = Number.isNaN(value) ? Number.parseFloat(defaultValue) : value;
                value = Number.isNaN(value) ? null : value;
              }
              break;
            }
            case 'string':
            default: {
              value = `${value}`.toLowerCase();
            }
          }
        }

        let action;
        const actionPathToUse = originalValue == null ? actionPathIfNoValue : actionPath;
        const defaultActionToUse = originalValue == null ? defaultActionIfNoValue : defaultAction;
        let actionDataTypeToUse;
        if (typeof castMessage === 'object') {
          action = actionPathToUse ? _.get(castMessage, actionPathToUse.replace(/^\$\./, ''), defaultActionToUse) : defaultActionToUse;
          actionDataTypeToUse = actionPathToUse ? actionDataType : defaultActionDataType;
        } else {
          action = castMessage || defaultActionToUse;
          actionDataTypeToUse = castMessage ? actionDataType : defaultActionDataType;
        }
        actionDataTypeToUse = originalValue == null ? defaultActionDataTypeIfNoValue : actionDataTypeToUse;

        if (action) {
          switch (actionDataTypeToUse) {
            case 'null': {
              action = null;
              break;
            }
            case 'boolean': {
              if (typeof action !== 'boolean') {
                action = action === 'true';
              }
              break;
            }
            case 'number': {
              if (typeof action !== 'number') {
                action = Number.parseFloat(action ? action.replaceAll(/\D/g, '') : defaultActionToUse);
                action = Number.isNaN(action) ? Number.parseFloat(defaultActionToUse) : action;
                action = Number.isNaN(action) ? 0 : action;
              }
              break;
            }
            case 'string':
            default: {
              action = `${action}`.toLowerCase();
            }
          }
        }

        return {
          action,
          value,
        };
      },
    }]));

    const smartHomeMQTTClient = new MQTTClient('token', '', '0', deviceLinks, {
      devName: 'Smart Home API',
      uuid: '8fb00271-c0db-4d4e-b234-9867272af017',
    }, logger);
    smartHomeMQTTClient.connect();

    // add remaining globals
    fn = getFunctions();
    global.fn = fn;

    // set routes
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

    // STEP 8: Start server
    app.listen(port, () => logger.info(`Smart Home REST Server started on port: ${port}`));
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
