const crypto = require('crypto');
const request = require('request');
const EventEmitter = require('events');
const MerossCloudHubDevice = require('./MerossLocalHubDevice');
const MerossCloudDevice = require('./MerossLocalDevice');

const SECRET = '23x17ahWarFH6w29';
const MEROSS_URL = 'https://iot.meross.com';
const LOGIN_URL = `${MEROSS_URL}/v1/Auth/Login`;
const DEV_LIST = `${MEROSS_URL}/v1/Device/devList`;
const SUBDEV_LIST = `${MEROSS_URL}/v1/Hub/getSubDevices`;

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  while (nonce.length < length) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function encodeParams(parameters) {
  const jsonstring = JSON.stringify(parameters);
  return Buffer.from(jsonstring).toString('base64');
}

class MerossLocal extends EventEmitter {
  /*
      email
      password
  */

  constructor(options) {
    super();

    this.options = options || {};
    this.token = null;
    this.key = null;
    this.userId = null;
    this.userEmail = null;
    this.authenticated = false;

    this.devices = {};
  }

  authenticatedPost(url, paramsData, callback) {
    const nonce = generateRandomString(16);
    const timestampMillis = Date.now();
    const loginParams = encodeParams(paramsData);

    // Generate the md5-hash (called signature)
    const datatosign = SECRET + timestampMillis + nonce + loginParams;
    const md5hash = crypto.createHash('md5').update(datatosign).digest('hex');
    const headers = {
      Authorization: `Basic ${this.token || ''}`,
      vender: 'Meross',
      AppVersion: '1.3.0',
      AppLanguage: 'EN',
      'User-Agent': 'okhttp/3.6.0',
    };

    const payload = {
      params: loginParams,
      sign: md5hash,
      timestamp: timestampMillis,
      nonce,
    };

    const options = {
      url,
      method: 'POST',
      headers,
      form: payload,
    };
    this.options.logger?.(`HTTP-Call: ${JSON.stringify(options)}`);
    // Perform the request.
    request(options, (error, response, body) => {
      if (!error && response && response.statusCode === 200 && body) {
        this.options.logger?.(`HTTP-Response OK: ${body}`);
        let mutableBody;
        try {
          mutableBody = JSON.parse(body);
        } catch (err) {
          mutableBody = {};
        }

        if (mutableBody.info === 'Success') {
          return callback && callback(null, mutableBody.data);
        }
        return callback && callback(new Error(`${mutableBody.apiStatus}: ${mutableBody.info}`));
      }
      this.options.logger?.(`HTTP-Response Error: ${error} / Status=${response ? response.statusCode : '--'}`);
      return callback && callback(error);
    });
  }

  connectDevice(deviceId, deviceObj, dev) {
    this.devices[deviceId] = deviceObj;
    this.devices[deviceId].on('connected', () => {
      this.emit('connected', deviceId);
    });
    this.devices[deviceId].on('close', (error) => {
      this.emit('close', deviceId, error);
    });
    this.devices[deviceId].on('error', (error) => {
      if (!this.listenerCount('error')) {
        return;
      }
      this.emit('error', deviceId, error);
    });
    this.devices[deviceId].on('reconnect', () => {
      this.emit('reconnect', deviceId);
    });
    this.devices[deviceId].on('data', (namespace, payload) => {
      this.emit('data', deviceId, namespace, payload);
    });
    this.devices[deviceId].on('rawData', (message) => {
      this.emit('rawData', deviceId, message);
    });
    this.emit('deviceInitialized', deviceId, dev, this.devices[deviceId]);
    this.devices[deviceId].connect();
  }

  connect(callback) {
    const data = {
      email: this.options.email,
      password: this.options.password,
    };

    this.authenticatedPost(LOGIN_URL, data, (err, loginResponse) => {
      // console.log(loginResponse);
      if (err) {
        callback?.(err);
        return;
      }
      if (!loginResponse) {
        callback?.(new Error('No valid Login Response data received'));
        return;
      }
      this.token = loginResponse.token;
      this.key = loginResponse.key;
      this.userId = loginResponse.userid;
      this.userEmail = loginResponse.email;
      this.authenticated = true;

      this.authenticatedPost(DEV_LIST, {}, (err, deviceList) => {
        // console.log(JSON.stringify(deviceList, null, 2));

        let initCounter = 0;
        let deviceListLength = 0;
        if (deviceList && Array.isArray(deviceList)) {
          deviceListLength = deviceList.length;
          deviceList.forEach((dev) => {
            // const deviceType = dev.deviceType;
            if (dev.deviceType.startsWith('msh300')) {
              this.options.logger?.(`${dev.uuid} Detected Hub`);
              this.authenticatedPost(SUBDEV_LIST, { uuid: dev.uuid }, (err, subDeviceList) => {
                this.connectDevice(
                  dev.uuid,
                  new MerossCloudHubDevice(this.token, this.key, this.userId, dev, subDeviceList),
                  dev,
                );
                initCounter += 1;
                if (initCounter === deviceListLength) {
                  callback?.(null, deviceListLength);
                }
              });
            } else {
              this.connectDevice(dev.uuid,
                new MerossCloudDevice(this.token, this.key, this.userId, dev),
                dev);
              initCounter += 1;
            }
          });
        }

        if (initCounter === deviceListLength) {
          callback?.(null, deviceListLength);
        }
      });
    });

    /*

    /app/64416/subscribe <-- {"header":{"messageId":"b5da1e168cba7a681afcff82eaf703c8","namespace":"Appliance.System.Online","timestamp":1539614195,"method":"PUSH","sign":"b16c2c4cbb5acf13e6b94990abf5b140","from":"/appliance/1806299596727829081434298f15a991/subscribe","payloadVersion":1},"payload":{"online":{"status":2}}}
    /app/64416/subscribe <-- {"header":{"messageId":"4bf5dfaaa0898243a846c1f2a93970fe","namespace":"Appliance.System.Online","timestamp":1539614201,"method":"PUSH","sign":"f979692120e7165b2116abdfd464ca83","from":"/appliance/1806299596727829081434298f15a991/subscribe","payloadVersion":1},"payload":{"online":{"status":1}}}
    /app/64416/subscribe <-- {"header":{"messageId":"46182b62a9377a8cc0147f22262a23f3","namespace":"Appliance.System.Report","method":"PUSH","payloadVersion":1,"from":"/appliance/1806299596727829081434298f15a991/publish","timestamp":1539614201,"timestampMs":78,"sign":"048fad34ca4d00875a026e33b16caf1b"},"payload":{"report":[{"type":"1","value":"0","timestamp":1539614201}]}}
    TIMEOUT
    err: Error: Timeout, res: undefined
    /app/64416/subscribe <-- {"header":{"messageId":"8dbe0240b2c03dcefda87a758a228d21","namespace":"Appliance.Control.ToggleX","method":"PUSH","payloadVersion":1,"from":"/appliance/1806299596727829081434298f15a991/publish","timestamp":1539614273,"timestampMs":27,"sign":"0f1ab22db05842eb94714b669b911aff"},"payload":{"togglex":{"channel":1,"onoff":1,"lmTime":1539614273}}}
    /app/64416/subscribe <-- {"header":{"messageId":"6ecacf6453bb0a4256f8bf1f5dd1d835","namespace":"Appliance.Control.ToggleX","method":"PUSH","payloadVersion":1,"from":"/appliance/1806299596727829081434298f15a991/publish","timestamp":1539614276,"timestampMs":509,"sign":"b8281d71ef8ab5420a1382af5ff9fc34"},"payload":{"togglex":{"channel":1,"onoff":0,"lmTime":1539614276}}}

    {"header":{"messageId":"98fee66789f75eb0e149f2a5116f919c","namespace":"Appliance.Control.ToggleX","method":"PUSH","payloadVersion":1,"from":"/appliance/1806299596727829081434298f15a991/publish","timestamp":1539633281,"timestampMs":609,"sign":"dd6bf3acee81a6c46f6fedd02515ddf3"},"payload":{"togglex":[{"channel":0,"onoff":0,"lmTime":1539633280},{"channel":1,"onoff":0,"lmTime":1539633280},{"channel":2,"onoff":0,"lmTime":1539633280},{"channel":3,"onoff":0,"lmTime":1539633280},{"channel":4,"onoff":0,"lmTime":1539633280}]}}
    */
  }

  getDevice(uuid) {
    return this.devices[uuid];
  }

  disconnectAll(force) {
    for (let i = 0; i < this.devices.length; i++) {
      const deviceId = this.devices[i];
      if (this.devices[deviceId]) {
        this.devices[deviceId].disconnect(force);
      }
    }
  }
}

module.exports = MerossLocal;
