const TuyaDevice = require('./device');

class Light extends TuyaDevice {
  /* Brightness */
  async supportsBrightness(){
    return await this.supportsFeature('brightness');
  }
  async getBrightness(){
    // Converts string to number and calculates to percentage
    return JSON.parse((await this.getSkills())['brightness']) / 255;
  }
  async setBrightness(value) {
    return await this._api.setState({
      devId: this._deviceId,
      command: 'brightnessSet',
      setState: value,
    });
  }


  /* Color*/
  async supportsColor(){
    return await this.supportsFeature('color');
  }
  async getColor(){
    return (await this.getSkills())['color'];
  }

  /* Color Temperatur */
  async supportsColorTemperature(){
    return await this.supportsFeature('color_temp');
  }
  async getColorTemperature(){
    return (await this.getSkills())['color_temp'];
  }
}
module.exports = Light;
