const { promisify } = require('util');
const MerossDevice = require('./device');

class Dimmer extends MerossDevice {
  constructor(options) {
    super(options);

    this.lightValues = {
      brightness: 100,
    };

    this.controlLight = promisify(this.device.controlLight).bind(this.device);
  }

  async turnOn() {
    const response = await super.turnOn();
    if (response?.success && response?.device?.data) {
      response.device.data.light_state = this.lightValues;
    }
    return response;
  }

  async turnOff() {
    const response = await super.turnOff();
    if (response?.success && response?.device?.data) {
      response.device.data.light_state = this.lightValues;
    }
    return response;
  }

  async getLightValues() {
    try {
      const response = await this.getSystemAllData();
      this.lightValues = {
        brightness: response?.all?.digest?.light?.luminance || null,
      };
      return this.lightValues;
    } catch (error) {
      return false;
    }
  }

  async supportsBrightness() {
    return this.supportsFeature('Appliance.Control.Light', ({ capacity }) => [4].includes(capacity));
  }

  async getBrightness() {
    try {
      const response = await this.getSystemAllData();
      return response?.all?.digest?.light?.luminance || null;
    } catch (error) {
      return false;
    }
  }

  async setBrightness(value) {
    return this.setLightValues({ brightness: value }).catch(() => { });
  }
}

module.exports = Dimmer;
