const TuyaDevice = require('./device');

class Climate extends TuyaDevice {
  async setTemperature(value) {
    return this.api.setState({
      devId: this.deviceId,
      command: 'temperatureSet',
      setState: value,
    });
  }

  async setFanMode(value) {
    return this.api.setState({
      devId: this.deviceId,
      command: 'windSpeedSet',
      setState: value,
    });
  }

  async setOperationMode(value) {
    return this.api.setState({
      devId: this.deviceId,
      command: 'modeSet',
      setState: value,
    });
  }

  async supportsMode() {
    return this.supportsFeature('mode');
  }

  async supportsWindspeed() {
    return this.supportsFeature('windspeed');
  }

  async supportsHumidity() {
    return this.supportsFeature('humidity');
  }
}
module.exports = Climate;
