module.exports = () => {
  const returnObj = {};

  const {
    DataTypes,
    fn,
    fs,
    Model,
    Op,
    path,
    sequelize,
  } = global;

  const processFilter = (filter, obj) => {
    if (Array.isArray(filter)) {
      if (filter.length === 0) {
        return true;
      }
      return filter.some((subFilter) => {
        if (Array.isArray(subFilter)) {
          return processFilter(subFilter, obj);
        }
        if (Object.keys(subFilter || {}).length === 0) {
          return true;
        }
        return Object.entries(subFilter)
          .every(([attribute, value]) => {
            const actualValue = obj[attribute];
            if (Array.isArray(value)) {
              return value.includes(actualValue);
            }

            return actualValue === value;
          });
      });
    }

    if (Object.keys(filter || {}).length === 0) {
      return true;
    }
    return processFilter([filter], obj);
  };

  const convertFilterToSequelizeWhere = (filter) => {
    const where = {};
    if (Array.isArray(filter)) {
      if (filter.length === 0) {
        return {};
      }
      const orFilter = [];
      filter.forEach((subFilter) => {
        if (Array.isArray(subFilter)) {
          orFilter.push(convertFilterToSequelizeWhere(subFilter));
        } else if (Object.keys(subFilter || {}).length > 0) {
          orFilter.push(subFilter);
        }
      });
      where[Op.or] = orFilter;
    } else if (Object.keys(filter || {}).length > 0) {
      return filter;
    }
    return where;
  };

  returnObj.loadModels = () => {
    const modelParams = { DataTypes, Model, sequelize };
    return Object.fromEntries(fn.filterMap(fs.readdirSync(path.join(__dirname, '../models')),
      (file) => file.match(/\.js$/), (file) => [
        file.replace(/\.js$/, ''), // eslint-disable-next-line import/no-dynamic-require, global-require
        require(path.join(__dirname, '../models', file.replace(/\.js$/, '')))(modelParams),
      ]));
  };

  returnObj.getData = async (models) => (
    Object.fromEntries(
      await Promise.all(Object.entries(models).map(([modelName, model]) => (
        async (modelName, model) => {
          const rawAttributes = Object.keys(model.rawAttributes);
          const instances = await model.findAll({
            ...(rawAttributes.includes('active') ? { where: { active: true } } : {}),
            ...(rawAttributes.includes('order') ? { order: ['order'] } : {}),
            raw: true,
          });

          return [modelName, instances];
        })(modelName, model))),
    )
  );

  returnObj.findOne = async (modelName, filter) => {
    const {
      data,
      models,
    } = global;

    const useCache = ['1', 'true'].includes(process.env.USE_CACHE);
    if (useCache) {
      if (data[modelName]) {
        return data[modelName].find((instance) => processFilter(filter, instance));
      }

      throw new Error(`Could not find model ${modelName}`);
    } else if (models[modelName]) {
      const instance = await models[modelName].findOne({
        where: {
          ...convertFilterToSequelizeWhere(filter),
          active: true,
        },
        raw: true,
      });
      Object.entries(models[modelName].rawAttributes).forEach(([fieldName, { type }]) => {
        if (type.constructor.name === 'BOOLEAN' && instance[fieldName] !== undefined) {
          instance[fieldName] = !!instance[fieldName];
        }
      });
      return instance;
    }

    throw new Error(`Could not find model ${modelName}`);
  };

  returnObj.findAll = async (modelName, filter) => {
    const {
      data,
      models,
    } = global;

    if (!global.models[modelName]) {
      throw new Error(`Could not find model ${modelName}`);
    }

    const rawAttributes = Object.keys(models[modelName].rawAttributes);
    const useCache = ['1', 'true'].includes(process.env.USE_CACHE);
    if (useCache) {
      if (data[modelName]) {
        return data[modelName]
          .filter((instance) => processFilter(filter, instance))
          .sort((instance1, instance2) => {
            // ORDER BY order ASC, label ASC, name ASC, id ASC
            if (rawAttributes.includes('order')) {
              if (instance1.order !== instance2.order) {
                return instance1.order - instance2.order;
              }
            }
            if (rawAttributes.includes('label')) {
              if (instance1.label.toLowerCase() !== instance2.label.toLowerCase()) {
                return instance1.label.toLowerCase() <= instance2.label.toLowerCase() ? -1 : 1;
              }
            }
            if (rawAttributes.includes('name')) {
              if (instance1.name.toLowerCase() !== instance2.name.toLowerCase()) {
                return instance1.name.toLowerCase() <= instance2.name.toLowerCase() ? -1 : 1;
              }
            }
            if (rawAttributes.includes('id')) {
              return instance1.id - instance2.id;
            }
            return 0;
          });
      }

      throw new Error(`Could not find model ${modelName}`);
    } else if (models[modelName]) {
      return (await models[modelName].findAll({
        where: {
          ...convertFilterToSequelizeWhere(filter),
          active: true,
        },
        order: [
          ...rawAttributes.includes('order') ? [['order']] : [],
          ...rawAttributes.includes('label') ? [['label']] : [],
          ...rawAttributes.includes('name') ? [['name']] : [],
          ...rawAttributes.includes('id') ? [['id']] : [],
        ],
        raw: true,
      })).map((instance) => {
        Object.entries(models[modelName].rawAttributes).forEach(([fieldName, { type }]) => {
          if (type.constructor.name === 'BOOLEAN' && instance[fieldName] !== undefined) {
            // eslint-disable-next-line no-param-reassign
            instance[fieldName] = !!instance[fieldName];
          }
        });
        return instance;
      });
    }

    throw new Error(`Could not find model ${modelName}`);
  };

  returnObj.getDevicesByModelId = async (model, modelId) => {
    if (model === 'device') {
      return [(await returnObj.findOne('Device', { id: modelId }))];
    }

    if (model === 'room') {
      return returnObj.findAll('Device', { roomId: modelId });
    }

    if (model === 'group') {
      const groupModels = await returnObj.findAll('GroupModel', { groupId: modelId });
      const groupModelInstances = await fn.asyncArrayIterator(groupModels, 'flatMap', async ({ model: groupModel, modelId: groupModelId }) => returnObj.getDevicesByModelId(groupModel, groupModelId));
      return groupModelInstances.flatMap((instances) => instances);
    }

    return [];
  };

  return returnObj;
};
