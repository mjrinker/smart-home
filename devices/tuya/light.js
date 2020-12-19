const TuyaDevice = require('./device');

class Light extends TuyaDevice {
  /* Brightness */
  async supportsBrightness() {
    return this.supportsFeature('brightness');
  }

  async getBrightness() {
    // Converts string to number and calculates to percentage
    return JSON.parse((await this.getSkills()).brightness) / 255;
  }

  async setBrightness(value) {
    return this.api.setState({
      devId: this.deviceId,
      command: 'brightnessSet',
      setState: value,
    });
  }

  /* Color */
  async supportsColor() {
    return this.supportsFeature('color');
  }

  async getColor() {
    return (await this.getSkills()).color;
  }

  /* Color Temperature */
  async supportsColorTemperature() {
    return this.supportsFeature('color_temp');
  }

  async getColorTemperature() {
    return (await this.getSkills()).color_temp;
  }
}
module.exports = Light;
