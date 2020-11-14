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

  fn.asyncArrayIterator = async (array, iterator, callback) => {
    const useIterator = iterator === 'forEach' ? 'map' : iterator;
    return Promise.all(array[useIterator]((value, key) => callback(value, key)));
  };

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

  fn.filterMap = (collection, filterCallback, mapCallback) => {
    const array = [];
    collection.forEach((element, index) => {
      let condition = null;
      if (_.isFunction(filterCallback)) {
        condition = filterCallback(element, index);
      } else if (_.isPlainObject(filterCallback)) {
        condition = _.isMatch(element, filterCallback);
      } else if (Array.isArray(filterCallback)) {
        condition = _.isMatch(element, { [filterCallback[0]]: filterCallback[1] });
      } else {
        condition = element.get(filterCallback);
      }

      if (_.isFunction(condition)) {
        condition = condition();
      }

      if (condition) {
        let newElement = null;
        if (_.isFunction(mapCallback)) {
          newElement = mapCallback(element, index);
        } else {
          newElement = element.get(mapCallback);
        }

        if (_.isFunction(newElement)) {
          newElement = newElement();
        }

        array.push(newElement);
      }
    });

    return array;
  };

  fn.filterObjectProperties = (obj, props) => (
    Object.fromEntries(props.map((prop) => [prop, _.get(obj, prop)]))
  );

  fn.getMilliseconds = (timeString) => {
    const timeUnits = timeString.replace(/([a-z]+)/gi, '$1<!--DELIMITER-->').split('<!--DELIMITER-->');
    return timeUnits.map((timeUnit) => {
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
    }).filter((amount) => amount).reduce((a, b) => a + b, 0);
  };

  fn.isInTimeRange = (startTime, endTime) => {
    const now = new Date();
    const today = new Date(now);
    const yesterday = new Date(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    yesterday.setDate(today.getDate() - 1);

    let startSuntimeDay = tomorrow;
    if (startTime.match(/^sunset/i)
      && now < getSunrise(location.lat, location.lng, tomorrow)) {
      startSuntimeDay = today;
    }

    let endSuntimeDay = tomorrow;
    if (endTime.match(/^sunrise/i)
      && now < getSunset(location.lat, location.lng, tomorrow)) {
      endSuntimeDay = today;
    }

    const start = startTime ? fn.parseTime(startTime, startSuntimeDay) : yesterday;
    const end = endTime ? fn.parseTime(endTime, endSuntimeDay) : tomorrow;
    return now >= start && now < end;
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
    params.routeList.forEach((route) => {
      let remainingVersions = [...versions];
      const path = (route.prefix || params.prefix) + route.path;
      const versionRoutesObj = {};
      route.versions.forEach((routeVersions, index) => {
        if (index < route.versions.length - 1) {
          remainingVersions = remainingVersions.filter((version) => (
            !routeVersions.versions.includes(version)
          ));
        } else {
          // eslint-disable-next-line no-param-reassign
          routeVersions.versions = remainingVersions;
        }

        routeVersions.versions.forEach((versionNumber) => {
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
              version = _.reverse(versions).find((versionNumber) => (
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
    Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [fn.slugify(key), fn.slugify(value)]),
    )
  );

  fn.slugifyKeys = (obj) => (
    Object.fromEntries(Object.entries(obj).map(([key, value]) => [fn.slugify(key), value]))
  );

  fn.slugifyValues = (obj) => (
    Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, fn.slugify(value)]))
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
