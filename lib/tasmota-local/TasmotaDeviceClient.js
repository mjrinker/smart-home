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

const getColorValue = (color) => {
  switch (color) {
    case 'red': {
      return '1';
    }
    case 'green': {
      return '2';
    }
    case 'blue': {
      return '3';
    }
    case 'orange': {
      return '4';
    }
    case 'lightGreen': {
      return '5';
    }
    case 'lightBlue': {
      return '6';
    }
    case 'amber': {
      return '7';
    }
    case 'cyan': {
      return '8';
    }
    case 'purple': {
      return '9';
    }
    case 'yellow': {
      return '10';
    }
    case 'pink': {
      return '11';
    }
    case 'white': {
      return '12';
    }
    case 'next': {
      return '+';
    }
    case 'previous': {
      return '-';
    }
    default: {
      return color;
    }
  }
};

class TasmotaDeviceClient extends EventEmitter {
  constructor(userId, password, device, logger) {
    super();

    this.waitingMessages = {};
    this.password = password;
    this.userId = userId;
    this.device = device;
    this.logger = logger;
  }

  connect(callback) {
    const domain = process.env.LOCAL_MQTT_HOSTNAME || 'localhost';
    const port = process.env.TASMOTA_MQTT_PORT;
    const clientId = `app:DVES_${this.device.id}-${process.env.ENVIRONMENT}`;
    const hashedPassword = crypto.createHash('md5').update(this.password).digest('hex');

    this.client = mqtt.connect({
      protocol: 'mqtts',
      host: domain,
      port,
      clientId,
      username: this.userId,
      password: hashedPassword,
      key: fs.readFileSync(`${__dirname}/../../certs/${this.device.devName}.key.pem`),
      cert: fs.readFileSync(`${__dirname}/../../certs/${this.device.devName}.crt.pem`),
      passphrase: this.password,
      ca: fs.readFileSync(`${__dirname}/../../certs/ca.key.pem`),
      rejectUnauthorized: false,
      keepalive: 30,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      this.client.subscribe(`stat/tasmota_${this.device.id}/RESULT`, (err) => {
        if (err) {
          this.emit('error', err);
        }
      });

      callback?.();
      this.emit('connected');
    });

    this.client.on('message', (topic, message) => {
      if (!message) {
        return;
      }

      let mutableMessage;
      try {
        mutableMessage = JSON.parse(message.toString());
      } catch (err) {
        mutableMessage = message.toString();
      }

      if (mutableMessage && typeof mutableMessage === 'object' && !Array.isArray(mutableMessage)) {
        Object.keys(mutableMessage).forEach((command) => {
          const messageId = `tasmota_${this.device.id}/RESULT/${command.replace(/\d+$/, '').toLowerCase()}`;
          this.waitingMessages[messageId] = mutableMessage;
        });
      } else {
        const command = topic.replace(/.*\/([^/]*)$/, '$1').replace(/\d+$/, '').toLowerCase();
        const messageId = topic.replace(/^.*?\/tasmota_/, 'tasmota_').replace(/\/([^/]*)$/, `/RESULT/${command}`);
        this.waitingMessages[messageId] = mutableMessage;
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
      this.logger.info(this.device.devLabel, '.'.repeat(Math.abs(30 - this.device.devLabel.length)), brightGreen('connected'));
    });
    this.on('error', (error) => {
      this.logger.error(this.device.devLabel, '.'.repeat(Math.abs(30 - this.device.devLabel.length)), red('error'));
      if (error) {
        this.logger.error(error);
      }
    });
    this.on('close', (error) => {
      this.logger.info(this.device.devLabel, '.'.repeat(Math.abs(30 - this.device.devLabel.length)), brightBlue('close'));
      if (error) {
        this.logger.error(error);
      }
    });
    this.on('reconnect', () => {
      this.logger.info(this.device.devLabel, '.'.repeat(Math.abs(30 - this.device.devLabel.length)), yellow('reconnect'));
    });

    // mqtt.Client#end([force], [options], [cb])
    // mqtt.Client#reconnect()
  }

  disconnect(force) {
    this.client.end(force);
  }

  async publishMessage(command, payload) {
    // eslint-disable-next-line global-require
    const delay = require('delay');
    const topic = `tasmota_${this.device.id}`;
    const messageIds = [];
    if (command === 'Json') {
      Object.keys(payload).forEach((cmd) => {
        messageIds.push(`${topic}/RESULT/${cmd.replace(/\d+$/, '').toLowerCase()}`);
      });
    } else {
      messageIds.push(`${topic}/RESULT/${command.replace(/\d+$/, '').toLowerCase()}`);
    }

    this.client.publish(`cmnd/${topic}/${command}`, typeof payload === 'object' ? JSON.stringify(payload) : payload);
    this.emit('rawSendData', payload);
    let response;
    const timeout = 20000;
    for (let i = 0; messageIds.every((messageId) => this.waitingMessages[messageId] === undefined); i += 20) {
      if (i >= timeout) {
        throw new Error('Timeout');
      }
      await delay(20);
      const messageId = messageIds.find((messageId) => this.waitingMessages[messageId] !== undefined) || messageIds[0];
      response = this.waitingMessages[messageId];
      if (response) {
        delete this.waitingMessages[messageId];
        break;
      }
    }
    return response;
  }

  async getAllStatusInfo() {
    // {"Status":{"Module":1,"FriendlyName":"XXX","Topic":"sonoff","ButtonTopic":"0","Power":0,"PowerOnState":0,"LedState":1,"SaveData":0,"SaveState":1,"ButtonRetain":0,"PowerRetain":0},"StatusPRM":{"Baudrate":115200,"GroupTopic":"sonoffs","OtaUrl":"XXX","Uptime":"1 02:33:26","Sleep":150,"BootCount":32,"SaveCount":72,"SaveAddress":"FB000"},"StatusFWR":{"Version":"5.12.0a","BuildDateTime":"2018.02.11 16:15:40","Boot":31,"Core":"2_4_0","SDK":"2.1.0(deb1901)"},"StatusLOG":{"SerialLog":0,"WebLog":4,"SysLog":0,"LogHost":"domus1","LogPort":514,"SSId1":"XXX","SSId2":"XXX","TelePeriod":300,"SetOption":"00000001"},"StatusMEM":{"ProgramSize":457,"Free":544,"Heap":23,"ProgramFlashSize":1024,"FlashSize":1024,"FlashMode":3},"StatusNET":{"Hostname":"XXX","IPAddress":"192.168.178.XX","Gateway":"192.168.178.XX","Subnetmask":"255.255.255.XX","DNSServer":"192.168.178.XX","Mac":"2C:3A:E8:XX:XX:XX","Webserver":2,"WifiConfig":4},"StatusTIM":{"UTC":"Thu Feb 15 00:00:50 2018","Local":"Thu Feb 15 01:00:50 2018","StartDST":"Sun Mar 25 02:00:00 2018","EndDST":"Sun Oct 28 03:00:00 2018","Timezone":1},"StatusSNS":{"Time":"2018.02.15 01:00:50","Switch1":"OFF"},"StatusSTS":{"Time":"2018.02.15 01:00:50","Uptime":"1 02:33:26","Vcc":3.504,"POWER":"OFF","Wifi":{"AP":1,"SSId":"XXX","RSSI":100,"APMac":"34:31:C4:XX:XX:XX"}}}
    return this.publishMessage('Status', 0);
  }

  async getOnlineStatus() {
    try {
      return !!(await this.getAllStatusInfo());
    } catch (e) {
      if (e.message === 'Timeout') {
        return false;
      }
      throw e;
    }
  }

  async getPowerState(channel = 1) {
    return (await this.publishMessage(`Power${channel}`, {}))?.POWER;
  }

  async togglePower(onOff, channel = 1) {
    const powerState = onOff ? 'ON' : 'OFF';
    const payload = onOff == null ? 'TOGGLE' : powerState;
    return this.publishMessage(`Power${channel}`, payload);
  }

  async setLightValues(light, dimmerAdjust) {
    const colorMode = dimmerAdjust ? 2 : 1;
    const adjustedTemperature = light.temperature ? ((light.temperature / 100) * (500 - 153)) + 153 : 0;
    const payload = {
      ...(light.color ? { [`Color${colorMode}`]: getColorValue(light.color) } : {}),
      ...(light.brightness ? { Dimmer: light.brightness } : {}),
      ...(light.temperature ? { CT: getColorValue(adjustedTemperature) } : {}),
    };
    return this.publishMessage('Json', payload);
  }

  async getLightColor() {
    return this.publishMessage('Color1', {});
  }

  async setLightColor(color, dimmerAdjust) {
    const mode = dimmerAdjust ? 2 : 1;
    const value = getColorValue(color);
    return this.publishMessage(`Color${mode}`, value);
  }

  async getLightColorTemperature() {
    const rawTemperature = await this.publishMessage('CT', {});
    return ((rawTemperature - 153) / (500 - 153)) * 100;
  }

  async setLightColorTemperature(temperature) {
    const adjustedTemperature = ((temperature / 100) * (500 - 153)) + 153;
    return this.publishMessage('CT', adjustedTemperature);
  }

  async getLightBrightness() {
    return this.getDimmerLevel();
  }

  async setLightBrightness(brightness) {
    /**
     * brightness possible values:
     * 0..100 = set dimmer value from 0 to 100%
     * + = increase by DimmerStep value (default = 10)
     * - = decrease by DimmerStep value (default = 10)
     * < = decrease to 1
     * > = increase to 100
     * ! = stop any dimmer fade in progress at current dimmer level
     */
    return this.setDimmerLevel(brightness);
  }

  async getDimmerLevel() {
    return this.publishMessage('Dimmer', {});
  }

  async setDimmerLevel(level) {
    /**
     * level possible values:
     * 0..100 = set dimmer value from 0 to 100%
     * + = increase by DimmerStep value (default = 10)
     * - = decrease by DimmerStep value (default = 10)
     * < = decrease to 1
     * > = increase to 100
     * ! = stop any dimmer fade in progress at current dimmer level
     */
    return this.publishMessage('Json', { Dimmer: level });
  }

  static getPowerTopic() {
    return {
      topic: 'stat/tasmota_{{deviceId}}/RESULT',
      valueExtractor: (message) => message?.POWER,
      eventExtractor: (message) => {
        const powerValue = message?.POWER?.toLowerCase();
        if (powerValue && Object.keys(message).length === 1) {
          return powerValue;
        }
        return null;
      },
    };
  }

  static getDimmerTopic() {
    return {
      topic: 'stat/tasmota_{{deviceId}}/RESULT',
      valueExtractor: (message) => message?.Dimmer,
      eventExtractor: (message) => (message?.Dimmer == null ? null : 'dimmer'),
    };
  }
}

module.exports = TasmotaDeviceClient;
