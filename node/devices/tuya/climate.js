const TuyaDevice = require('./device');

class Climate extends TuyaDevice {
  async setTemperature(value) {
    return await this._api.setState({
      devId: this._deviceId,
      command: 'temperatureSet',
      setState: value,
    });
  }
  async setFanMode(value) {
    return await this._api.setState({
      devId: this._deviceId,
      command: 'windSpeedSet',
      setState: value,
    });
  }
  async setOperationMode(value) {
    return await this._api.setState({
      devId: this._deviceId,
      command: 'modeSet',
      setState: value,
    });
  }

  async supportsMode(){
    return await this.supportsFeature('mode');
  }
  async supportsWindspeed(){
    return await this.supportsFeature('windspeed');
  }
  async supportsHumidity(){
    return await this.supportsFeature('humidity');
  }
}
module.exports = Climate;
