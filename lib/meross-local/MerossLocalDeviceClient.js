const mqtt = require('mqtt');
const crypto = require('crypto');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const {
  brightBlue,
  brightGreen,
  red,
  yellow,
} = require('../../utilities/ansicodes');

const generateRandomString = (length) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  while (nonce.length < length) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
};

class MerossLocalDeviceClient extends EventEmitter {
  constructor(token, key, userId, device, logger) {
    super();

    this.clientResponseTopic = null;
    this.waitingMessageIds = {};

    this.token = token;
    this.key = key;
    this.userId = userId;
    this.device = device;
    this.logger = logger;
  }

  connect() {
    // const domain = this.dev.domain || "eu-iot.meross.com";
    const domain = process.env.LOCAL_MQTT_HOSTNAME || 'localhost';
    const appId = crypto.createHash('md5').update(`API${uuidv4()}`).digest('hex');
    const clientId = `app:${appId}`;

    // Password is calculated as the MD5 of USERID concatenated with KEY
    const hashedPassword = crypto.createHash('md5').update(this.userId + this.key).digest('hex');

    this.client = mqtt.connect({
      protocol: 'mqtts',
      host: domain,
      // 'port': 2001,
      port: 8883,
      clientId,
      username: this.userId,
      password: hashedPassword,
      rejectUnauthorized: false,
      keepalive: 30,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      // console.log("Connected. Subscribe to user topics");

      this.client.subscribe(`/app/${this.userId}/subscribe`, (err) => {
        if (err) {
          this.emit('error', err);
        }
        // console.log('User Subscribe Done');
      });

      this.clientResponseTopic = `/app/${this.userId}-${appId}/subscribe`;

      this.client.subscribe(this.clientResponseTopic, (err) => {
        if (err) {
          this.emit('error', err);
        }
        // console.log('User Response Subscribe Done');
      });
      this.emit('connected');
    });

    this.client.on('message', (topic, message) => {
      if (!message) {
        return;
      }
      // message is Buffer
      // console.log(topic + ' <-- ' + message.toString());
      let mutableMessage;
      try {
        mutableMessage = JSON.parse(message.toString());
      } catch (err) {
        this.emit('error', `JSON parse error: ${err}`);
        return;
      }
      if (mutableMessage.header.from && !mutableMessage.header.from.includes(this.device.uuid)) {
        return;
      }
      // {"header":{"messageId":"14b4951d0627ea904dd8685c480b7b2e","namespace":"Appliance.Control.ToggleX","method":"PUSH","payloadVersion":1,"from":"/appliance/1806299596727829081434298f15a991/publish","timestamp":1539602435,"timestampMs":427,"sign":"f33bb034ac2d5d39289e6fa3dcead081"},"payload":{"togglex":[{"channel":0,"onoff":0,"lmTime":1539602434},{"channel":1,"onoff":0,"lmTime":1539602434},{"channel":2,"onoff":0,"lmTime":1539602434},{"channel":3,"onoff":0,"lmTime":1539602434},{"channel":4,"onoff":0,"lmTime":1539602434}]}}

      // If the message is the RESP for some previous action, process return the control to the "stopped" method.
      if (this.waitingMessageIds[mutableMessage.header.messageId]) {
        if (this.waitingMessageIds[mutableMessage.header.messageId].timeout) {
          clearTimeout(this.waitingMessageIds[mutableMessage.header.messageId].timeout);
        }
        this.waitingMessageIds[mutableMessage.header.messageId].callback(
          null,
          mutableMessage.payload || mutableMessage,
        );
        delete this.waitingMessageIds[mutableMessage.header.messageId];
      } else if (mutableMessage.header.method === 'PUSH') { // Otherwise process it accordingly
        const namespace = mutableMessage.header ? mutableMessage.header.namespace : '';
        this.emit('data', namespace, mutableMessage.payload || mutableMessage);
      }
      this.emit('rawData', mutableMessage);
    });
    this.client.on('error', (error) => {
      this.emit('error', error ? error.toString() : null);
    });
    this.client.on('close', (error) => {
      this.emit('close', error ? error.toString() : null);
    });
    this.client.on('reconnect', () => {
      this.emit('reconnect');
    });

    this.on('connected', () => {
      this.logger.info(this.device.devName, '.'.repeat(Math.abs(30 - this.device.devName.length)), brightGreen('connected'));
    });
    this.on('error', (error) => {
      this.logger.error(this.device.devName, '.'.repeat(Math.abs(30 - this.device.devName.length)), red('error'));
      if (error) {
        this.logger.error(error);
      }
    });
    this.on('close', (error) => {
      this.logger.info(this.device.devName, '.'.repeat(Math.abs(30 - this.device.devName.length)), brightBlue('close'));
      if (error) {
        this.logger.error(error);
      }
    });
    this.on('reconnect', () => {
      this.logger.info(this.device.devName, '.'.repeat(Math.abs(30 - this.device.devName.length)), yellow('reconnect'));
    });

    // mqtt.Client#end([force], [options], [cb])
    // mqtt.Client#reconnect()
  }

  disconnect(force) {
    this.client.end(force);
  }

  publishMessage(method, namespace, payload, callback) {
    // if not subscribed und so ...
    const messageId = crypto.createHash('md5').update(generateRandomString(16)).digest('hex');
    const timestamp = Math.round(new Date().getTime() / 1000); // int(round(time.time()))

    const signature = crypto.createHash('md5').update(messageId + this.key + timestamp).digest('hex');

    const data = {
      header: {
        from: this.clientResponseTopic,
        messageId, // Example: "122e3e47835fefcd8aaf22d13ce21859"
        method, // Example: "GET",
        namespace, // Example: "Appliance.System.All",
        payloadVersion: 1,
        sign: signature, // Example: "b4236ac6fb399e70c3d61e98fcb68b74",
        timestamp,
      },
      payload,
    };
    this.client.publish(`/appliance/${this.device.uuid}/subscribe`, JSON.stringify(data));
    if (callback) {
      this.waitingMessageIds[messageId] = {};
      this.waitingMessageIds[messageId].callback = callback;
      this.waitingMessageIds[messageId].timeout = setTimeout(() => {
        // console.log('TIMEOUT');
        if (this.waitingMessageIds[messageId].callback) {
          this.waitingMessageIds[messageId].callback(new Error('Timeout'));
        }
        delete this.waitingMessageIds[messageId];
      }, 20000);
    }
    this.emit('rawSendData', data);
    return messageId;
  }

  getSystemAllData(callback) {
    // {"all":{"system":{"hardware":{"type":"mss425e","subType":"eu","version":"2.0.0","chipType":"mt7682","uuid":"1806299596727829081434298f15a991","macAddress":"34:29:8f:15:a9:91"},"firmware":{"version":"2.1.2","compileTime":"2018/08/13 10:42:53 GMT +08:00","wifiMac":"34:31:c4:73:3c:7f","innerIp":"192.168.178.86","server":"iot.meross.com","port":2001,"userId":64416},"time":{"timestamp":1539612975,"timezone":"Europe/Berlin","timeRule":[[1521939600,7200,1],[1540688400,3600,0],[1553994000,7200,1],[1572138000,3600,0],[1585443600,7200,1],[1603587600,3600,0],[1616893200,7200,1],[1635642000,3600,0],[1648342800,7200,1],[1667091600,3600,0],[1679792400,7200,1],[1698541200,3600,0],[1711846800,7200,1],[1729990800,3600,0],[1743296400,7200,1],[1761440400,3600,0],[1774746000,7200,1],[1792890000,3600,0],[1806195600,7200,1],[1824944400,3600,0]]},"online":{"status":1}},"digest":{"togglex":[{"channel":0,"onoff":0,"lmTime":1539608841},{"channel":1,"onoff":0,"lmTime":1539608841},{"channel":2,"onoff":0,"lmTime":1539608841},{"channel":3,"onoff":0,"lmTime":1539608841},{"channel":4,"onoff":0,"lmTime":1539608841}],"triggerx":[],"timerx":[]}}}

    return this.publishMessage('GET', 'Appliance.System.All', {}, callback);
  }

  getSystemDebug(callback) {
    // {"debug":{"system":{"version":"2.1.2","sysUpTime":"114h16m34s","localTimeOffset":7200,"localTime":"Mon Oct 15 16:23:03 2018","suncalc":"7:42;19:49"},"network":{"linkStatus":"connected","signal":50,"ssid":"ApollonHome","gatewayMac":"34:31:c4:73:3c:7f","innerIp":"192.168.178.86","wifiDisconnectCount":1},"cloud":{"activeServer":"iot.meross.com","mainServer":"iot.meross.com","mainPort":2001,"secondServer":"smart.meross.com","secondPort":2001,"userId":64416,"sysConnectTime":"Mon Oct 15 08:06:40 2018","sysOnlineTime":"6h16m23s","sysDisconnectCount":5,"pingTrace":[]}}}
    return this.publishMessage('GET', 'Appliance.System.Debug', {}, callback);
  }

  getSystemAbilities(callback) {
    // {"payloadVersion":1,"ability":{"Appliance.Config.Key":{},"Appliance.Config.WifiList":{},"Appliance.Config.Wifi":{},"Appliance.Config.Trace":{},"Appliance.System.All":{},"Appliance.System.Hardware":{},"Appliance.System.Firmware":{},"Appliance.System.Debug":{},"Appliance.System.Online":{},"Appliance.System.Time":{},"Appliance.System.Ability":{},"Appliance.System.Runtime":{},"Appliance.System.Report":{},"Appliance.System.Position":{},"Appliance.System.DNDMode":{},"Appliance.Control.Multiple":{"maxCmdNum":5},"Appliance.Control.ToggleX":{},"Appliance.Control.TimerX":{"sunOffsetSupport":1},"Appliance.Control.TriggerX":{},"Appliance.Control.Bind":{},"Appliance.Control.Unbind":{},"Appliance.Control.Upgrade":{},"Appliance.Digest.TriggerX":{},"Appliance.Digest.TimerX":{}}}
    return this.publishMessage('GET', 'Appliance.System.Ability', {}, callback);
  }

  getSystemReport(callback) {
    return this.publishMessage('GET', 'Appliance.System.Report', {}, callback);
  }

  getSystemRuntime(callback) { // Wifi Strength
    /* eslint-disable no-tabs */
    // "payload": {
    // 		"runtime": {
    // 			"signal": 86
    // 		}
    // 	}
    /* eslint-enable no-tabs */
    return this.publishMessage('GET', 'Appliance.System.Runtime', {}, callback);
  }

  getSystemDNDMode(callback) { // DND Mode (LED)
    /* eslint-disable no-tabs */
    // "payload": {
    // 		"DNDMode": {
    // 			"mode": 0
    // 		}
    // 	}
    /* eslint-enable no-tabs */
    return this.publishMessage('GET', 'Appliance.System.DNDMode', {}, callback);
  }

  setSystemDNDMode(onoff, callback) {
    const payload = { DNDMode: { mode: onoff ? 1 : 0 } };
    return this.publishMessage('SET', 'Appliance.System.DNDMode', payload, callback);
  }

  getOnlineStatus(callback) {
    return this.publishMessage('GET', 'Appliance.System.Online', {}, callback);
  }

  getConfigWifiList(callback) {
    // {"wifiList":[]}
    return this.publishMessage('GET', 'Appliance.Config.WifiList', {}, callback);
  }

  getConfigTrace(callback) {
    // {"trace":{"ssid":"","code":0,"info":""}}
    return this.publishMessage('GET', 'Appliance.Config.Trace', {}, callback);
  }

  getControlPowerConsumption(callback) {
    return this.publishMessage('GET', 'Appliance.Control.Consumption', {}, callback);
  }

  getControlPowerConsumptionX(callback) {
    return this.publishMessage('GET', 'Appliance.Control.ConsumptionX', {}, callback);
  }

  getControlElectricity(callback) {
    return this.publishMessage('GET', 'Appliance.Control.Electricity', {}, callback);
  }

  controlToggle(onoff, callback) {
    const payload = { toggle: { onoff: onoff ? 1 : 0 } };
    return this.publishMessage('SET', 'Appliance.Control.Toggle', payload, callback);
  }

  controlToggleX(channel, onoff, callback) {
    const payload = { togglex: { channel, onoff: onoff ? 1 : 0 } };
    return this.publishMessage('SET', 'Appliance.Control.ToggleX', payload, callback);
  }

  controlSpray(channel, mode, callback) {
    const payload = { spray: { channel, mode: mode || 0 } };
    return this.publishMessage('SET', 'Appliance.Control.Spray', payload, callback);
  }

  controlRollerShutterUp(channel, callback) {
    const payload = { position: { position: 100, channel } };
    return this.publishMessage('SET', 'Appliance.RollerShutter.Position', payload, callback);
  }

  controlRollerShutterDown(channel, callback) {
    const payload = { position: { position: 0, channel } };
    return this.publishMessage('SET', 'Appliance.RollerShutter.Position', payload, callback);
  }

  controlRollerShutterStop(channel, callback) {
    const payload = { position: { position: -1, channel } };
    return this.publishMessage('SET', 'Appliance.RollerShutter.Position', payload, callback);
  }

  getRollerShutterState(callback) {
    return this.publishMessage('GET', 'Appliance.RollerShutter.State', {}, callback);
  }

  getRollerShutterPosition(callback) {
    return this.publishMessage('GET', 'Appliance.RollerShutter.Position', {}, callback);
  }

  controlGarageDoor(channel, open, callback) {
    const payload = { state: { channel, open: open ? 1 : 0, uuid: this.device.uuid } };
    return this.publishMessage('SET', 'Appliance.GarageDoor.State', payload, callback);
  }

  // {"light":{"capacity":6,"channel":0,"rgb":289,"temperature":80,"luminance":100}}
  controlLight(light, callback) {
    const payload = { light };
    return this.publishMessage('SET', 'Appliance.Control.Light', payload, callback);
  }

  controlDiffusorSpray(type, channel, mode, callback) {
    const payload = { spray: [{ channel, mode: mode || 0, uuid: this.device.uuid }] };
    return this.publishMessage('SET', 'Appliance.Control.Diffuser.Spray', payload, callback);
  }

  controlDiffusorLight(type, light, callback) {
    const mutableObject = { ...light };
    mutableObject.uuid = this.device.uuid;
    const payload = { light: [mutableObject] };
    return this.publishMessage('SET', 'Appliance.Control.Diffuser.Light', payload, callback);
  }
}

module.exports = MerossLocalDeviceClient;
