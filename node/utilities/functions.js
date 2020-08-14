module.exports = (envVars) => {
  const fn = {};

  const {
    _,
    app,
    delay,
    getSunrise,
    getSunset,
    location,
    versions,
  } = envVars;

  fn.asyncArrayIterator = async (array, iterator, callback) => (
    Promise.all(array[iterator]((value, key) => callback(value, key)))
  );

  fn.asyncMw = (func) => (req, res, next) => {
    Promise.resolve(func(req, res, next))
      .catch((error) => {
        let newError = error;
        if (!(error instanceof Error)) {
          const message = (error && typeof (error) === 'string') ? error : 'Server Error';
          newError = new Error(message);
        }

        console.error(newError);
        if (next) {
          return next(newError);
        }

        return res.status(500).json({ error: newError });
      });
  };

  fn.castActionValue = (value, datatype) => {
    switch (datatype) {
      case 'null': {
        return null;
      }

      case 'boolean': {
        return !!parseInt(value, 10) || true;
      }

      case 'number': {
        return parseFloat(value, 10);
      }

      case 'string':
        // falls through
      default: {
        return `${value}`;
      }
    }
  };

  fn.getMilliseconds = (timeString) => {
    const timeUnits = timeString.replace(/([a-z]+)/gi, '$1<!--DELIMITER-->').split('<!--DELIMITER-->');
    return timeUnits._map((timeUnit) => {
      const amount = parseInt(timeUnit.replace(/\D/g, ''), 10);
      const unit = timeUnit.replace(/[^a-z]/gi, '');
      switch (unit) {
        case 'y': {
          return amount * 1000 * 60 * 60 * 24 * 365;
        }

        case 'M': {
          return amount * 1000 * 60 * 60 * 24 * 30;
        }

        case 'w': {
          return amount * 1000 * 60 * 60 * 24 * 7;
        }

        case 'd': {
          return amount * 1000 * 60 * 60 * 24;
        }

        case 'h': {
          return amount * 1000 * 60 * 60;
        }

        case 'm': {
          return amount * 1000 * 60;
        }

        case 's': {
          return amount * 1000;
        }

        case 'ms': {
          return amount;
        }

        default: {
          return '';
        }
      }
    })._filter((amount) => amount)._reduce((a, b) => a + b, 0);
  };

  fn.isInTimeRange = (startTime, endTime) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const start = startTime ? fn.parseTime(startTime, startTime.match(/^sunrise/i) ? today : tomorrow) : today;
    const end = endTime ? fn.parseTime(endTime, tomorrow) : tomorrow;
    return today >= start && today < end;
  };

  fn.parseTime = (timeString, suntimeDay = new Date()) => {
    const today = new Date();
    let date = new Date(today);
    if (timeString.match(/^sunrise/i)) {
      date = getSunrise(location.lat, location.lng, suntimeDay);
      const offset = timeString.replace(/sunrise/i, '');
      if (offset !== '') {
        const operator = offset.match(/^[-+]/)[0];
        const amount = offset.match(/(\d+[yMwdhms])/)[0];
        const offsetMilliseconds = fn.getMilliseconds(amount);
        if (operator === '+') {
          date.setTime(date.getTime() + offsetMilliseconds);
        } else if (operator === '-') {
          date.setTime(date.getTime() - offsetMilliseconds);
        }
      }
    } else if (timeString.match(/^sunset/i)) {
      date = getSunset(location.lat, location.lng, suntimeDay);
      const offset = timeString.replace(/sunset/i, '');
      if (offset !== '') {
        const operator = offset.match(/^[-+]/)[0];
        const amount = offset.match(/(\d+[yMwdhms])/)[0];
        const offsetMilliseconds = fn.getMilliseconds(amount);
        if (operator === '+') {
          date.setTime(date.getTime() + offsetMilliseconds);
        } else if (operator === '-') {
          date.setTime(date.getTime() - offsetMilliseconds);
        }
      }
    } else if (timeString.match(/\d{2}:\d{2}(?::\d{2})?/)) {
      const timeUnits = timeString.match(/(\d{2}):(\d{2})(:\d{2})?/);
      const hours = parseInt(timeUnits[1] || '0', 10);
      const minutes = parseInt(timeUnits[2] || '0', 10);
      const seconds = parseInt(timeUnits[3] || '0', 10);
      date.setHours(hours, minutes, seconds);
    } else if (timeString === 'default') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    } else {
      const error = new Error(`Invalid time ${timeString}`);
      error.name = 'INVALID_TIME';
      throw error;
    }

    return date;
  };

  fn.pascalCase = (string) => (
    string.substring(0, 1).toUpperCase() + _.camelCase(string).substring(1)
  );

  fn.setRoutes = (params) => {
    params.routeList._forEach((route) => {
      let remainingVersions = [...versions];
      const path = (route.prefix || params.prefix) + route.path;
      const versionRoutesObj = {};
      route.versions._forEach((routeVersions, index) => {
        if (index < route.versions.length - 1) {
          remainingVersions = remainingVersions._filter((version) => (
            !routeVersions.versions.includes(version)
          ));
        } else {
          // eslint-disable-next-line no-param-reassign
          routeVersions.versions = remainingVersions;
        }

        routeVersions.versions._forEach((versionNumber) => {
          if (params.controller[routeVersions.func]) {
            versionRoutesObj[versionNumber] = params.controller[routeVersions.func];
          } else {
            console.log('ROUTES:', routeVersions.func, 'not found');
          }
        });
      });

      if (route.auth) {
        // TODO do something
      } else {
        app[route.method](path, fn.asyncMw((req, res, next) => {
          let versionSupported = true;
          let version = req.header('X-ApiVersion') || versions[versions.length - 1];
          if (!versionRoutesObj[version]) {
            if (version.match(/\d+/) || version.match(/\d+\.\d+/)) {
              version = _.reverse(versions)._find((versionNumber) => (
                versionNumber.substring(0, version.length) === version
              ));

              versionSupported = !!version;
            } else {
              versionSupported = false;
            }
          }

          if (!versionSupported) {
            return res.status(400).json({
              success: false,
              status: 400,
              error: 'VERSION_NOT_SUPPORTED_ERROR',
              message: `Version not supported: ${version}`,
            });
          }

          return versionRoutesObj[version](req, res, next);
        }));
      }
    });
  };

  fn.slugify = (string) => _.snakeCase(`${string}`);

  fn.slugifyEntries = (obj) => (
    obj._map((value, key) => [fn.slugify(key), fn.slugify(value)])._fromPairs()
  );

  fn.slugifyKeys = (obj) => (
    obj._map((value, key) => [fn.slugify(key), value])._fromPairs()
  );

  fn.slugifyValues = (obj) => (
    obj._map((value, key) => [key, fn.slugify(value)])._fromPairs()
  );

  fn.waitUntil = async (condition, callback) => {
    let checkCondition;
    while (!checkCondition) {
      checkCondition = condition;
      if (typeof condition === 'function') {
        checkCondition = condition();
      }
      await delay(50);
    }

    return typeof callback === 'function' ? callback() : callback;
  };

  return fn;
};
