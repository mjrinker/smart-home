const fs = require('fs');
const mqtt = require('mqtt');
const crypto = require('crypto');
const EventEmitter = require('events');
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

class TasmotaDevice extends EventEmitter {
  constructor(token, key, userId, password, dev, logger) {
    super();

    this.clientResponseTopic = null;
    this.waitingMessageIds = {};

    this.token = token;
    this.key = key;
    this.password = password;
    this.userId = userId;
    this.dev = dev;
    this.logger = logger;
  }

  connect() {
    const domain = '192.168.0.107';
    const port = 8884;
    const clientId = `app:DVES_${this.dev.id}`;

    // Password is calculated as the MD5 of USERID concatenated with KEY
    const hashedPassword = crypto.createHash('md5').update(this.password).digest('hex');

    this.client = mqtt.connect({
      protocol: 'mqtts',
      host: domain,
      port,
      clientId,
      username: this.userId,
      password: hashedPassword,
      key: fs.readFileSync(`/Users/mrinker/code/personal/smart-home/certs/${this.dev.devName}.key.pem`),
      cert: fs.readFileSync(`/Users/mrinker/code/personal/smart-home/certs/${this.dev.devName}.crt.pem`),
      passphrase: this.password,
      ca: fs.readFileSync('/Users/mrinker/code/personal/smart-home/certs/ca.key.pem'),
      rejectUnauthorized: false,
      keepalive: 30,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      // console.log("Connected. Subscribe to user topics");

      this.client.subscribe(`stat/tasmota_${this.dev.id}/POWER`, (err) => {
        if (err) {
          this.emit('error', err);
        }
        // console.log('User Subscribe Done');
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
      console.log(mutableMessage);
      if (mutableMessage.header.from && !mutableMessage.header.from.includes(this.dev.id)) {
        // return;
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
      this.logger.info(this.dev.devName, '.'.repeat(Math.abs(30 - this.dev.devName.length)), brightGreen('connected'));
    });
    this.on('error', (error) => {
      this.logger.error(this.dev.devName, '.'.repeat(Math.abs(30 - this.dev.devName.length)), red('error'));
      if (error) {
        this.logger.error(error);
      }
    });
    this.on('close', (error) => {
      this.logger.info(this.dev.devName, '.'.repeat(Math.abs(30 - this.dev.devName.length)), brightBlue('close'));
      if (error) {
        this.logger.error(error);
      }
    });
    this.on('reconnect', () => {
      this.logger.info(this.dev.devName, '.'.repeat(Math.abs(30 - this.dev.devName.length)), yellow('reconnect'));
    });

    // mqtt.Client#end([force], [options], [cb])
    // mqtt.Client#reconnect()
  }

  disconnect(force) {
    this.client.end(force);
  }

  publishMessage(method, namespace, payload, callback) {
    const messageId = crypto.createHash('md5').update(generateRandomString(16)).digest('hex');
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = crypto.createHash('md5').update(messageId + this.key + timestamp).digest('hex');
    const data = {
      header: {
        from: this.clientResponseTopic,
        messageId, // Example: "122e3e47835fefcd8aaf22d13ce21859"
        method, // Example: "GET",
        payloadVersion: 1,
        sign: signature, // Example: "b4236ac6fb399e70c3d61e98fcb68b74",
        timestamp,
      },
      payload,
    };
    this.client.publish(`cmnd/tasmota_${this.dev.id}/${namespace}`, JSON.stringify(data));
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

  getAllStatusInfo(callback) {
    // {"Status":{"Module":1,"FriendlyName":"XXX","Topic":"sonoff","ButtonTopic":"0","Power":0,"PowerOnState":0,"LedState":1,"SaveData":0,"SaveState":1,"ButtonRetain":0,"PowerRetain":0},"StatusPRM":{"Baudrate":115200,"GroupTopic":"sonoffs","OtaUrl":"XXX","Uptime":"1 02:33:26","Sleep":150,"BootCount":32,"SaveCount":72,"SaveAddress":"FB000"},"StatusFWR":{"Version":"5.12.0a","BuildDateTime":"2018.02.11 16:15:40","Boot":31,"Core":"2_4_0","SDK":"2.1.0(deb1901)"},"StatusLOG":{"SerialLog":0,"WebLog":4,"SysLog":0,"LogHost":"domus1","LogPort":514,"SSId1":"XXX","SSId2":"XXX","TelePeriod":300,"SetOption":"00000001"},"StatusMEM":{"ProgramSize":457,"Free":544,"Heap":23,"ProgramFlashSize":1024,"FlashSize":1024,"FlashMode":3},"StatusNET":{"Hostname":"XXX","IPAddress":"192.168.178.XX","Gateway":"192.168.178.XX","Subnetmask":"255.255.255.XX","DNSServer":"192.168.178.XX","Mac":"2C:3A:E8:XX:XX:XX","Webserver":2,"WifiConfig":4},"StatusTIM":{"UTC":"Thu Feb 15 00:00:50 2018","Local":"Thu Feb 15 01:00:50 2018","StartDST":"Sun Mar 25 02:00:00 2018","EndDST":"Sun Oct 28 03:00:00 2018","Timezone":1},"StatusSNS":{"Time":"2018.02.15 01:00:50","Switch1":"OFF"},"StatusSTS":{"Time":"2018.02.15 01:00:50","Uptime":"1 02:33:26","Vcc":3.504,"POWER":"OFF","Wifi":{"AP":1,"SSId":"XXX","RSSI":100,"APMac":"34:31:C4:XX:XX:XX"}}}
    return this.publishMessage('GET', 'Status', 0, callback);
  }

  // TODO is this a thing for Tasmota?
  getSystemAbilities(callback) {
    // {"payloadVersion":1,"ability":{"Appliance.Config.Key":{},"Appliance.Config.WifiList":{},"Appliance.Config.Wifi":{},"Appliance.Config.Trace":{},"Appliance.System.All":{},"Appliance.System.Hardware":{},"Appliance.System.Firmware":{},"Appliance.System.Debug":{},"Appliance.System.Online":{},"Appliance.System.Time":{},"Appliance.System.Ability":{},"Appliance.System.Runtime":{},"Appliance.System.Report":{},"Appliance.System.Position":{},"Appliance.System.DNDMode":{},"Appliance.Control.Multiple":{"maxCmdNum":5},"Appliance.Control.ToggleX":{},"Appliance.Control.TimerX":{"sunOffsetSupport":1},"Appliance.Control.TriggerX":{},"Appliance.Control.Bind":{},"Appliance.Control.Unbind":{},"Appliance.Control.Upgrade":{},"Appliance.Digest.TriggerX":{},"Appliance.Digest.TimerX":{}}}
    return this.publishMessage('GET', 'Appliance.System.Ability', {}, callback);
  }

  // TODO is this a thing for Tasmota?
  getOnlineStatus(callback) {
    return this.publishMessage('GET', 'Appliance.System.Online', {}, callback);
  }

  getPowerState(channel = 1, callback) {
    return this.publishMessage('GET', `Power${channel}`, {}, callback);
  }

  togglePower(channel = 1, onOff, callback) {
    const powerState = onOff ? 'ON' : 'OFF';
    const payload = onOff == null ? 'TOGGLE' : powerState;
    return this.publishMessage('SET', `Power${channel}`, payload, callback);
  }

  // TODO is this a thing for Tasmota?
  // {"light":{"capacity":6,"channel":0,"rgb":289,"temperature":80,"luminance":100}}
  controlLight(light, callback) {
    const payload = { light };
    return this.publishMessage('SET', 'Appliance.Control.Light', payload, callback);
  }

  controlSwitchDimmer(level, callback) {
    const payload = { Dimmer: level };
    return this.publishMessage('SET', 'Json', payload, callback);
  }
}

module.exports = TasmotaDevice;
