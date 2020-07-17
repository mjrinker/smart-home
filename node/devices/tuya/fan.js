const TuyaDevice = require('./device');

class Fan extends TuyaDevice {
  async setSpeed(value) {
    return await this._api.setState({
      devId: this._deviceId,
      command: 'windSpeedSet',
      setState: value,
    });
  }
  async supportsOcillate(){
    return await this.supportsFeature('direction');
  }


}
module.exports = Fan;
