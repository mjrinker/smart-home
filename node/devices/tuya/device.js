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
  }

  async turnOn() {
    return this.api.setState({
      devId: this.deviceId,
      setState: 'On',
    });
  }

  async turnOff() {
    return this.api.setState({
      devId: this.deviceId,
      setState: 'Off',
    });
  }

  async isOn() {
    return !!(await this.api.find({ id: this.deviceId }))?.data?.state;
  }

  async isOnline() {
    return !!(await this.api.find({ id: this.deviceId }))?.data?.online;
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
