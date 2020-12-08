class TuyaDevice {
  constructor(options) {
    if (!options.api) {
      throw new Error('Please pass the Tuya API');
    }
    this.api = options.api;

    if (!options.deviceId) {
      throw new Error('Please pass the Tuya Device ID');
    }
    this.deviceId = options.deviceId;

    if (!options.deviceDef) {
      throw new Error('Please pass the Tuya Device Definition');
    }
    this.deviceDef = options.deviceDef;
    this.name = this.deviceDef.devName;

    this.online = options.online || false;
    this.state = options.state || false;
    this.override = true;
    this.lock = false;
  }

  async turnOn() {
    this.state = true;
    const response = await this.api.setState({
      devId: this.deviceId,
      setState: 'On',
    });

    if (response?.header?.code === 'SUCCESS') {
      this.state = true;
    }

    return response;
  }

  async turnOff() {
    const response = await this.api.setState({
      devId: this.deviceId,
      setState: 'Off',
    });

    if (response?.header?.code === 'SUCCESS') {
      this.state = false;
    }

    return response;
  }

  async isOnline() {
    this.online = !!(await this.api.find({ id: this.deviceId }))?.data?.online;
    return this.online;
  }

  async isOn() {
    this.state = !!(await this.api.find({ id: this.deviceId }))?.data?.state;
    return this.state;
  }

  async getState() {
    return (await this.api.find({ id: this.deviceId }))?.data || {};
  }

  async toggle() {
    if (this.isOn()) {
      return this.turnOff();
    }

    return this.turnOn();
  }

  async getSkills() {
    const state = await this.api.find({
      devId: this.deviceId,
    });

    return state && state[0] && state[0].data;
  }

  async supportsFeature(feature) {
    const skills = await this.getSkills();
    return !!skills[feature];
  }
}
module.exports = TuyaDevice;
