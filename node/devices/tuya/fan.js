const TuyaDevice = require('./device');

class Fan extends TuyaDevice {
  async setSpeed(value) {
    return this.api.setState({
      devId: this.deviceId,
      command: 'windSpeedSet',
      setState: value,
    });
  }

  async supportsOcillate() {
    return this.supportsFeature('direction');
  }
}
module.exports = Fan;
