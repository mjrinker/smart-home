const MerossCloudDevice = require('./MerossCloudDevice');

class MerossCloudHubDevice extends MerossCloudDevice {
  constructor(token, key, userId, dev, subDeviceList) {
    super(token, key, userId, dev);

    this.subDeviceList = subDeviceList;
  }

  getHubBattery(callback) {
    const payload = { battery: [] };
    return this.publishMessage('GET', 'Appliance.Hub.Battery', payload, callback);
  }

  getMts100All(ids, callback) {
    const payload = { all: [] };
    ids.forEach((id) => payload.all.push({ id }));
    return this.publishMessage('GET', 'Appliance.Hub.Mts100.All', payload, callback);
  }

  controlHubToggleX(subId, onoff, callback) {
    const payload = { togglex: [{ id: subId, onoff: onoff ? 1 : 0 }] };
    return this.publishMessage('SET', 'Appliance.Hub.ToggleX', payload, callback);
  }

  controlHubMts100Mode(subId, mode, callback) {
    const payload = { mode: [{ id: subId, state: mode }] };
    return this.publishMessage('SET', 'Appliance.Hub.Mts100.Mode', payload, callback);
  }

  controlHubMts100Temperature(subId, temp, callback) {
    const mutableTemp = { ...temp };
    mutableTemp.id = subId;
    const payload = { temperature: [mutableTemp] };
    return this.publishMessage('SET', 'Appliance.Hub.Mts100.Temperature', payload, callback);
  }
}

module.exports = MerossCloudHubDevice;
