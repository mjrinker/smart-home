/**
* Example script using cloudtuya to connect, get states an change them
*/

require('dotenv').config();

const CloudTuya = require('./cloudtuya');
const BaseDevice = require('./devices/tuya/device');

const name = 'cloudtuya';

console.log('booting %s', name);
// Load local files
let deviceNicknames = {};
try {
  // eslint-disable-next-line global-require
  deviceNicknames = require('./device_config.json');
} catch (err) {
  console.error(err);
  console.warn('device_nicknames.json is missing. creating temporary');
  deviceNicknames = {};
}

async function main() {
  const api = new CloudTuya({
    userName: process.env.TUYA_USERNAME,
    password: process.env.TUYA_PASSWORD,
    bizType: process.env.BIZ_TYPE,
    countryCode: parseInt(process.env.COUNTRY_CODE, 10),
    region: process.env.REGION,
  });

  // Connect to cloud api and get access token.
  // const tokens = await api.login();

  // Get all devices registered on the Tuya app
  // let devices = await api.find();
  // console.log('devices');
  // console.log(devices);

  // Setting new Device ID
  const deviceId = deviceNicknames['Candle Socket'];

  const mySocket = new BaseDevice({ api, deviceId });
  // mySocket.turnOn();
  mySocket.turnOff();
  // const isOn = await mySocket.isOn();
  // console.log(isOn);
}
main();
