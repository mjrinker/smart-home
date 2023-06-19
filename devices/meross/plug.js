const MerossDevice = require('./device');

class Plug extends MerossDevice {
  constructor(options) {
    super(options);
  }

  async turnOn() {
    const response = await super.turnOn();
    if (response?.success && response?.device?.data) {
      response.device.data.lightState = this.lightValues;
    }
    return response;
  }

  async turnOff() {
    const response = await super.turnOff();
    if (response?.success && response?.device?.data) {
      response.device.data.lightState = this.lightValues;
    }
    return response;
  }
}

module.exports = Plug;
