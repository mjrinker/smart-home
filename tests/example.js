/**
* Example script using cloudtuya to connect, get states an change them
*/

require('dotenv').config();

const debug = require('debug')('cloudtuya');
const fs = require('fs');
const CloudTuya = require('./cloudtuya');
const Light = require('./devices/tuya/light');

const name = 'cloudtuya';

debug('booting %s', name);
// Load local files
let deviceData = {};
try {
  // eslint-disable-next-line global-require
  deviceData = require('./devices.json');
} catch (err) {
  console.warn('devices.json is missing. creating temporary');
  deviceData = [{}];
}
/**
* Save Data Such a Devices to file
* @param {Object} data to save
* @param {String} [file="./devices.json"] to save to
*/
function saveDataToFile(data, file = './devices.json') {
  debug(`Data ${JSON.stringify(data)}`);
  fs.writeFile(file, JSON.stringify(data), (err) => {
    if (err) {
      return debug(err);
    }
    debug(`The file ${file} was saved!`);
    return file;
  });
}

async function main() {
  const api = new CloudTuya({
    userName: process.env.TUYA_USERNAME,
    password: process.env.TUYA_PASSWORD,
    bizType: process.env.BIZ_TYPE,
    countryCode: parseInt(process.env.COUNTRY_CODE, 10),
    region: process.env.REGION,
  });

  // Test device read from devics.json saved at the end.
  let testId = deviceData[0].id || '10000000000';
  debug(`device data ${deviceData} and ${deviceData[0].id} id or all ${deviceData[0].name}`);

  // Connect to cloud api and get access token.
  const tokens = await api.login();
  debug(`Token ${JSON.stringify(tokens)}`);

  // Get all devices registered on the Tuya app
  const devices = await api.find();
  debug(`devices ${JSON.stringify(devices)}`);

  // Save device to device.json
  saveDataToFile(devices);

  // Setting new Device ID
  testId = devices[0].id;

  // Get state of a single device
  const deviceStates = await api.state({
    devId: testId,
  });
  const state = deviceStates.testId;
  debug(`testId ${testId}  has value ${state}`);
  debug(`devices ${JSON.stringify(deviceStates)}`);
  debug(`devices ${JSON.stringify(devices)}`);

  // Example how to turn on a lamp and set brightness
  const myLight = new Light({ api, deviceId: testId });

  myLight.turnOn();
  myLight.setBrightness(80);

  const brightness = await myLight.getBrightness();
  const isOn = (JSON.stringify(await myLight.isOn()));

  console.log(`lamp on: ${isOn}`);
  console.log(`brightness is set to ${brightness}`);
}
main();
