const MerossCloud = require('meross-cloud');

const options = {
  email: 'mjrinker@gmail.com',
  password: '0463NSi$5m559196z0h4qD@1VdzjEni%',
  // logger: console.log,
  logger: () => { },
};

const meross = new MerossCloud(options);

meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
  // console.log(`New device ${deviceId}: ${JSON.stringify(deviceDef)}`);

  device.on('connected', () => {
    // console.log(`DEV: ${deviceId} connected`);

    if (deviceDef.devName.includes('Matt')) {
      device.getSystemAbilities((sysAbilitiesError, sysAbilitiesResponse) => {
        // console.log(`Abilities: ${JSON.stringify(sysAbilitiesResponse)}`);

        device.getSystemAllData((sysDataError, sysDataResponse) => {
          // console.log(`All-Data: ${JSON.stringify(sysDataResponse)}`);

          setTimeout(() => {
            console.log('toggle ...');
            device.controlToggleX(
              0,
              !sysDataResponse.all.digest.light.onoff,
              (toggleXError, toggleXResponse) => {
                console.log(`Toggle Response: err: ${toggleXError}, res: ${JSON.stringify(toggleXResponse)}`);
              },
            );
            // const lightValues = {
            //   capacity: 5, // 1 = RGB, 2 = TEMPERATURE, 3 = (not supported), 4 = LUMINANCE, 5 = RGB_LUMINANCE, 6 = TEMPERATURE_LUMINANCE
            //   channel: 0,
            //   rgb: 0xa37fff,
            //   temperature: 30,
            //   luminance: 20,
            //   // transform: -1,
            // };
            // device.controlLight(lightValues, (controlLightError, controlLightResponse) => {
            //   console.log(`Light Control Response: err: ${controlLightError}, res: ${JSON.stringify(controlLightResponse)}`);
            // });
          }, 10);
        });
      });
    }
  });

  device.on('close', (error) => {
    // console.log(`DEV: ${deviceId} closed: ${error}`);
  });

  device.on('error', (error) => {
    // console.log(`DEV: ${deviceId} error: ${error}`);
  });

  device.on('reconnect', () => {
    // console.log(`DEV: ${deviceId} reconnected`);
  });

  device.on('data', (namespace, payload) => {
    console.log(`DEV: ${deviceId} ${namespace} - data: ${JSON.stringify(payload)}`);
  });
});

meross.on('connected', (deviceId) => {
  // console.log(`${deviceId} connected`);
});

meross.on('close', (deviceId, error) => {
  // console.log(`${deviceId} closed: ${error}`);
});

meross.on('error', (deviceId, error) => {
  // console.log(`${deviceId} error: ${error}`);
});

meross.on('reconnect', (deviceId) => {
  // console.log(`${deviceId} reconnected`);
});

meross.on('data', (deviceId, payload) => {
  console.log(`${deviceId} data: ${JSON.stringify(payload)}`);
});

meross.connect((error) => {
  console.log(`connect error: ${error}`);
});

const logout = () => {
  meross.authenticatedPost('https://iot.meross.com/v1/Profile/logout', {}, (err, logoutResponse) => {
    if (err) {
      console.error('could not log out', err);
      return;
    }

    console.log('logged out');
    process.exit();
  });
};

process.on('SIGINT', logout);
