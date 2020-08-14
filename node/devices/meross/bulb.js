const fetch = require('node-fetch');
const MerossDevice = require('./device');

class Bulb extends MerossDevice {
  async setLightValues(features = { brightness: null, color: null, temperature: null }) {
    const action = [
      ...(features.brightness ? ['brightness'] : []),
      ...(features.color ? ['color'] : []),
      ...(features.temperature ? ['temperature'] : []),
    ].join(',');

    const value = [
      ...(features.brightness ? [features.brightness] : []),
      ...(features.color ? [features.color] : []),
      ...(features.temperature ? [features.temperature] : []),
    ].join(',').replace(/#([0-9a-f]{6})/gi, '$1');

    return fetch(`${this.url}/device/${this.deviceId}/${action}?value=${value}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((response) => response.text().then((text) => {
      try {
        return JSON.parse(text);
      } catch (error) {
        return text;
      }
    }));
  }

  async supportsBrightness() {
    return this.supportsFeature('brightness');
  }

  async getBrightness() {
    return JSON.parse((await this.getSkills()).brightness);
  }

  async setBrightness(value) {
    return this.setLightValues({ brightness: value });
  }

  async supportsColor() {
    return this.supportsFeature('color');
  }

  async getColor() {
    return (await this.getSkills()).color;
  }

  async setColor(value) {
    return this.setLightValues({ color: value });
  }

  async supportsColorTemperature() {
    return this.supportsFeature('color_temp');
  }

  async getColorTemperature() {
    return (await this.getSkills()).color_temp;
  }

  async setColorTemperature(value) {
    return this.setLightValues({ temperature: value });
  }
}
module.exports = Bulb;
