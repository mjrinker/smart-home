const MerossDevice = require('./device');

class Thermostat extends MerossDevice {
  async setTemperature(value) {
    return fetch(`${this._url}/device/${this._deviceId}/temperature?value=${value}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }).then((response) => response.text().then((text) => {
      try {
        return JSON.parse(text);
      } catch (error) {
        return text;
      }
    }));
  }

  async setOperationMode(value) {
    return fetch(`${this._url}/device/${this._deviceId}/mode?value=${value}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }).then((response) => response.text().then((text) => {
      try {
        return JSON.parse(text);
      } catch (error) {
        return text;
      }
    }));
  }

  async supportsMode() {
    return true;
  }
}
module.exports = Thermostat;
