const fetch = require('node-fetch');

class MerossDevice {
  constructor(options) {
    if(!options.url){
      throw new Error('Please pass the Meross API URL');
    }
    this._url = options.url;

    if(!options.deviceId){
      throw new Error('Please pass the Meross Device ID');
    }
    this._deviceId = options.deviceId;
  }

  async turnOn() {
    return fetch(`${this._url}/device/${this._deviceId}/on`, {
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

  async turnOff() {
    return fetch(`${this._url}/device/${this._deviceId}/off`, {
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

  async isOn() {
    return fetch(`${this._url}/device/${this._deviceId}/is_on`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }).then((response) => response.text().then((text) => {
      try {
        return !!JSON.parse(text).is_on;
      } catch (error) {
        return false;
      }
    }));
  }

  async getSkills() {
    return fetch(`${this._url}/device/${this._deviceId}/skills`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }).then((response) => response.text().then((text) => {
      try {
        return JSON.parse(text).skills;
      } catch (error) {
        return {};
      }
    }));
  }

  async supportsFeature(feature) {
    var skills = await this.getSkills();
    return skills[feature] === 0 || !!skills[feature];
  }
}
module.exports = MerossDevice;