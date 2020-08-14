const fetch = require('node-fetch');
const MerossDevice = require('./device');

class Thermostat extends MerossDevice {
  async setTemperature(value) {
    return fetch(`${this.url}/device/${this.deviceId}/temperature?value=${value}`, {
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

  async setOperationMode(value) {
    return fetch(`${this.url}/device/${this.deviceId}/mode?value=${value}`, {
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

  static async supportsMode() {
    return true;
  }
}
module.exports = Thermostat;
