const _ = require('lodash');
const crypto = require('crypto');
const cryptoRandomString = require('crypto-random-string');
const debug = require('debug')('[MEROSS]');
const fetch = require('node-fetch');
const mqtt = require('paho-mqtt').MQTT;
const uuid = require('uuid');

const generateNonce = (length) => cryptoRandomString({ length, type: 'alphanumeric' }).toUpperCase();
const encodeParams = (params) => Buffer.from(JSON.stringify(params), 'utf8').toString('base64');
const generateMQTTPassword = (userID, key) => crypto.createHash('md5').update(`${userID}${key}`).digest('hex');
const generateMQTTClientIDAppID = () => {
  const randomUUID = uuid.v4();
  const appID = crypto.createHash('md5').update(`API${randomUUID}`).digest('hex');
  const clientID = `app:${appID}`;
  return { appID, clientID };
};

/**
* A MerossManager object
* @class
* @param {Object} options construction options
* @param {String} options.key API key
* @param {String} options.secret API secret
* @param {String} [options.region='eu'] region az=Americas, ay=Asia, eu=Europe)
* @param {String} [options.deviceID] ID of device calling API (defaults to a random value)
* @param {String} [options.mode='ANY'] Authorisation method (ANY, KEY, EMAIL)
* @param {String} options.userName App email to login to App on phone
* @param {String} options.password App password
* @param {String} [options.bizType='smart_life'] App business ('tuya' or 'smart_life')
* @param {String} [options.countryCode='44'] Country code (International dialing number)
* */
class MerossManager {
  constructor(options) {
    // super();
    // Set to empty object if undefined
    const config = (options) || {};
    this.devices = [];
    if (!config.userName || !config.password) {
      throw new Error('Missing loging email/pass');
    } else {
      this.core = {
        email: config.userName,
        password: config.password,
      };
    }

    this.uri = 'https://iot.meross.com';
    this.secret = '23x17ahWarFH6w29';

    this.errorCodes = {
      0: 'CODE_NO_ERROR',
      1019: 'CODE_TOKEN_INVALID',
      1022: 'CODE_TOKEN_EXPIRED',
      1301: 'CODE_TOO_MANY_TOKENS',
    };

    this.devicesByInternalID = {};

    const { appID, clientID } = generateMQTTClientIDAppID();

    this.appID = appID;
    this.clientID = clientID;

    this.mqttClient = new mqtt.Client('iot.meross.com', 2001, '', this.clientID);
  }

  /**
   *
   * @param {Object} options request options
   */
  async post(options) {
    // Set to empty object if undefined
    if (this.tokens && this.tokens.expires_in < 0) {
      this.getToken();
    }

    const timestampMillis = Date.now();
    const nonce = generateNonce(16);
    const loginParams = encodeParams(options.body);
    const md5Hash = crypto.createHash('md5').update(`${this.secret}${timestampMillis}${nonce}${loginParams}`).digest('hex');

    const config = (options) || {};
    config.method = 'POST';

    config.headers = {
      Authorization: this.tokens && this.tokens.token ? `Basic ${this.tokens.token}` : 'Basic',
      vender: 'Meross',
      AppVersion: '1.3.0',
      AppLanguage: 'EN',
      'User-Agent': 'okhttp/3.6.0',
      ...options.headers,
    };

    config.body = {
      nonce,
      params: loginParams,
      sign: md5Hash,
      timestamp: timestampMillis,
    };

    return new Promise((resolve, reject) => {
      fetch(config.uri, config).then((response) => {
        debug(`Response Status Code: ${response.status}`);
        if (response.status === 200) {
          response.text().then((body) => {
            try {
              const jsonBody = JSON.parse(body);
              const errorCode = jsonBody.apiStatus;
              const errorType = this.errorCodes[errorCode];

              if (!errorType) {
                reject(new Error(`[MEROSS] Unknown/Unhandled response code received from API. Response was: ${JSON.stringify(jsonBody)}`));
              }

              switch (errorType) {
                case 'CODE_NO_ERROR': {
                  resolve(jsonBody);
                  break;
                }
                case 'CODE_TOKEN_INVALID': {
                  reject(new Error('[MEROSS] The provided token is invalid'));
                  break;
                }
                case 'CODE_TOKEN_EXPIRED': {
                  reject(new Error('[MEROSS] The provided token has expired'));
                  break;
                }
                case 'CODE_TOO_MANY_TOKENS': {
                  reject(new Error('[MEROSS] You have issued too many tokens without logging out.'));
                  break;
                }
                default: {
                  reject(new Error(`[MEROSS] Failed request to API. Response was: ${JSON.stringify(jsonBody)}`));
                }
              }
            } catch (e) {
              resolve(body);
            }
          });
        } else {
          reject(new Error(`[MEROSS] Failed request to API. Response code: ${response.status}`));
        }
      }).catch((err) => {
        reject(err);
      });
    });
  }

  async discover(deviceUUID = null) {
    let devices = await this.listDevices();
    if (deviceUUID) {
      devices = devices.filter((device) => device.uuid === deviceUUID);
    }

    const discoveredNewDevices = [];
    const alreadyKnownDevices = {};
    devices.forEach((device) => {
      const deviceFromRegistry = this.lookupBaseByUUID(device.uuid);
      if (deviceFromRegistry) {
        alreadyKnownDevices[device] = deviceFromRegistry;
      } else {
        discoveredNewDevices.push(device);
      }
    });

    console.info(`The following devices were already known to me: ${alreadyKnownDevices}`);
    console.info(`The following devices are new to me: ${discoveredNewDevices}`);

    discoveredNewDevices.map((device) => (
      this.enrollNewDevice(device)
    ));

    alreadyKnownDevices.map((device) => (
      this.updateFromState(device)
    ));
  }

  lookupBaseByUUID(deviceUUID) {
    const results = Object.values(this.devicesByInternalID).filter((device) => (
      device.uuid === deviceUUID
    ));

    if (results.length === 1) {
      return results[0];
    }

    if (results.length > 1) {
      throw new Error(`Multiple devices found for deviceUUID ${deviceUUID}`);
    }

    return null;
  }

  async enrollNewDevice(device) {
    try {
      if (device.onlineStatus !== 1) {
        console.info(`Could not retrieve abilities for device ${device.devName} (${device.uuid}). This device won't be enrolled.`);
        return null;
      }

      abilities = await this.executeCommand(device.uuid, 'GET', 'Appliance.System.Ability', {});
    } catch (error) { }
  }

  async updateFromState(device) { }

  async executeCommand(destinationDeviceUUID, method, namespace, payload, timeout = 5) {
    if (this.mqttClient.isConnected()) {
      console.error('The MQTT client is not connected to the remote broker. Have you called init()?');
      const error = new Error('MQTT client not connected');
      error.name = 'UnconnectedError';
      throw error;
    }

    const { message } = this.buildMQTTMessage(method, namespace, payload);
    this.mqttClient.publish(this.buildDeviceRequestTopic(destinationDeviceUUID), message);
  }

  async listDevices() {
    const results = await this.post({ uri: `${this.uri}/v1/Device/devList` });
    return results.map((result) => (
      Object.fromEntries(Object.entries(result).map(([key, value]) => [_.camelCase(key), value]))
    ));
  }

  /**
   * @param {Object} opbtions
   */
  async find(options) {
    const config = (options) || {};
    // Scan network otherwise or no device id in options
    const uri = `${this.uri}/skill`;
    const data = {
      header: {
        name: 'Discovery',
        namespace: 'discovery',
        payloadVersion: 1,
      },
      payload: {
        accessToken: this.accessToken,
      },
    };
    const headers = {
      'Content-Type': 'application/json',
    };
    const postConfig = {
      uri,
      headers,
      body: data,
    };
    const { payload: { devices } } = await this.post(postConfig);
    this.devices = devices;
    this.currentDevices = devices;
    debug(devices);
    // Check if device is in device list first
    if (config.id) {
      const matchDevice = await this.devices.filter((device) => device.id === config.id);
      if (matchDevice) {
        this.currentDevices = matchDevice;
      }
    }

    return this.currentDevices;
  }

  // Converts true/false to ON/OFF
  static smap(itemState) {
    return (itemState && 'ON') || 'OFF';
  }

  // Convert text on/off, logic and numbers into 1/0 values
  static lmap(itemState) {
    if ((typeof itemState === 'number')
      && (itemState === 0
        || itemState === 1)) {
      return itemState;
    }
    if (typeof itemState === typeof true) {
      return (itemState && 1) || 0;
    }
    if (typeof itemState === 'string') {
      return (['on', 'true', '1']
        .includes(itemState.toLowerCase())
        && 1) || 0;
    }
    return itemState;
  }

  updateStatesCache(key, value, states) {
    this.states = (this.states) || {};
    this.states[key] = value;
    // eslint-disable-next-line no-param-reassign
    states[key] = value;
    return states;
  }

  async state(options) {
    let devices = await this.find(options);
    const config = (options) || {};
    debug(`prefilter ${JSON.stringify(devices)}`);
    devices = (config.id) ? devices.filter((device) => device.id === config.id) : devices;
    debug(`postfilter ${JSON.stringify(devices)}`);
    const states = {};
    const returnMap = await devices.map((device) => this
      .updateStatesCache(device.id, MerossManager.smap(device.data.state), states));
    debug(`Return map ${JSON.stringify(returnMap)}`);
    debug(states);
    return (states[config.id]) || states;
  }

  async setState(options) {
    const config = (options) || {};
    const payload = (config.payload) || {};
    // Scan network otherwise or no device id in options
    const uri = `${this.uri}/skill`;
    payload.accessToken = this.accessToken;
    payload.devId = config.devId;
    // dsp 1 default
    payload.value = MerossManager.lmap(config.setState);
    const command = config.command || 'turnOnOff';
    debug(payload);
    const data = {
      header: {
        name: command,
        namespace: 'control',
        payloadVersion: 1,
      },
      payload,
    };
    const headers = {
      'Content-Type': 'application/json',
    };
    const postConfig = {
      uri,
      headers,
      body: data,
    };
    debug(postConfig);
    const setProgress = await this.post(postConfig);
    return setProgress;
  }

  async login(options) {
    const config = options || {};
    const uri = `${this.uri}/v1/Auth/Login`;
    // Set email & password
    const data = config.core || this.core;

    const postConfig = {
      uri,
      body: JSON.stringify(data),
    };

    const tokens = await this.post(postConfig);
    this.tokens = tokens;
    this.tokens.issuedOn = new Date();
    debug(tokens);

    if (tokens && typeof tokens !== 'object') {
      console.error('tokens error: ', tokens);
      return null;
    }

    return tokens;
  }

  async logout() {
    debug(`Logging out. Invalidating cached credentials ${JSON.stringify(this.tokens)}`);
    const result = await this.post({ uri: `${this.uri}/v1/Profile/logout` });
    this.tokens = null;
    console.info('Logout successful.');
    return result;
  }

  async getToken(options) {
    return this.login(options);
  }
}

module.exports = MerossManager;
