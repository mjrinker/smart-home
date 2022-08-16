const constants = require('../helpers/constants');

module.exports = () => {
  const returnObj = {};

  const {
    _,
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

  returnObj.getModelsBy = async (models) => (
    Object.fromEntries(
      await Promise.all(Object.entries(models).map(([modelName, model]) => (
        async (modelName, model) => {
          const rawAttributes = Object.keys(model.rawAttributes);
          const instances = await model.findAll({
            ...(rawAttributes.includes('active') ? { where: { active: true } } : {}),
            ...(rawAttributes.includes('order') ? { order: ['order'] } : {}),
            raw: true,
          });

          const modelBy = Object.fromEntries(rawAttributes.map((attribute) => {
            const groupByCallback = attribute === 'model_id' ? (instance) => `${instance.model}_${instance.model_id}` : attribute;
            const groups = _.groupBy(instances, groupByCallback);
            return [attribute, groups];
          }));

          return [modelName, modelBy];
        })(modelName, model))),
    )
  );

  returnObj.getAliasesConfig = (modelsBy) => (
    Object.entries(modelsBy.Alias.alias).map(([alias, aliasObjects]) => [
      alias,
      fn.filterMap(aliasObjects,
        (aliasObject) => (
          aliasObject.model !== 'room'
          && modelsBy?.[fn.pascalCase(aliasObject.model)]?.id?.[aliasObject.model_id]?.length > 0
        ),
        (aliasObject) => (
          modelsBy[fn.pascalCase(aliasObject.model)].id[aliasObject.model_id][0].name
        )),
    ]).filter(([, modelNames]) => modelNames.length > 0)
  );

  returnObj.getColorsConfig = (modelsBy) => (
    Object.fromEntries(Object.entries(modelsBy.Color.name).map(([name, colorsByName]) => {
      const color = colorsByName[0];
      return [
        name, {
          label: color.label,
          value: color.value,
          displayValue: color.display_value,
        },
      ];
    }))
  );

  returnObj.getDeviceConfig = (modelsBy) => {
    const groupsConfig = returnObj.getGroupsConfig(modelsBy);
    const aliasesConfig = returnObj.getAliasesConfig(modelsBy);
    const groupsAliasesConfig = _.flatten(
      Object.entries(_.groupBy(groupsConfig.concat(aliasesConfig), 0))
        .map(([, pairs]) => (
          Object.entries(pairs.reduce((acc, pair) => {
            acc[pair[0]] = (acc[pair[0]] || []).concat(pair[1]);
            return acc;
          }, {}))
        )),
    );

    return Object.fromEntries(groupsAliasesConfig.concat(
      Object.entries(modelsBy.Device.name).flatMap(([deviceName, devicesByName]) => (
        devicesByName.map((device) => {
          const groupModels = modelsBy.GroupModel.model_id[`device_${device.id}`] || [];
          const deviceGroups = groupModels.flatMap((groupModel) => (
            modelsBy.Group.id[groupModel.group_id]
          ));

          const devicePresets = ((modelsBy.Preset.model_id[`device_${device.id}`] || []).concat(
            (
              deviceGroups.flatMap((group) => (
                modelsBy.Preset.model_id[`group_${group.id}`]
              )) || []
            ),
            (
              modelsBy.Preset.model_id[`room_${device.room_id}`] || []
            ),
          )).flatMap((preset) => preset);

          const deviceConditionalActions = _.groupBy(((modelsBy.ConditionalAction.model_id[`device_${device.id}`] || []).concat(
            (
              deviceGroups.flatMap((group) => (
                modelsBy.ConditionalAction.model_id[`group_${group.id}`]
              )) || []),
            (
              modelsBy.ConditionalAction.model_id[`room_${device.room_id}`] || []
            ),
          ) || []), 'action');

          return [
            deviceName,
            {
              ...device,
              ...(devicePresets ? {
                presets: Object.fromEntries(fn.filterMap(devicePresets,
                  (preset) => preset,
                  (preset) => {
                    const presetActions = Object.fromEntries(
                      (modelsBy.PresetAction.preset_id[preset.id] || []).map(
                        (presetAction) => [
                          presetAction.action,
                          fn.castActionValue(presetAction.value, presetAction.datatype),
                        ],
                      ),
                    );

                    return [preset.name, presetActions];
                  })),
              } : {}),
              ...(deviceConditionalActions ? {
                timeBased: Object.fromEntries(
                  Object.entries(deviceConditionalActions).map(([action, conditionalActions]) => {
                    const scheduledPresets = Object.fromEntries(fn.filterMap(conditionalActions, { condition_type: 'time' }, (conditionalAction) => {
                      const presetName = modelsBy.Preset.id?.[conditionalAction.preset_id]?.[0]?.name;
                      return [conditionalAction.condition || 'default', presetName];
                    }));
                    return [action, scheduledPresets];
                  }).filter((action) => action !== 'undefined'),
                ),
              } : {}),
            },
          ];
        })
      )),
    ));
  };

  returnObj.getGroupsConfig = (modelsBy) => (
    Object.entries(modelsBy.Group.name).flatMap(([groupName, groupObjects]) => (
      fn.filterMap(groupObjects,
        (group) => modelsBy?.GroupModel?.group_id?.[group.id]?.length > 0,
        (group) => [
          groupName,
          fn.filterMap(modelsBy.GroupModel.group_id[group.id],
            (groupModel) => (
              groupModel.model !== 'room'
              && modelsBy?.[fn.pascalCase(groupModel.model)]?.id?.[groupModel.model_id]?.length > 0
            ),
            (groupModel) => (
              modelsBy[fn.pascalCase(groupModel.model)].id[groupModel.model_id][0].name
            )),
        ])
    ))
  );

  returnObj.getRoomsConfig = (modelsBy) => _.sortBy(Object.values(modelsBy.Room.id), '0.order').flatMap((roomsById) => (
    roomsById.map((room) => ({
      id: room.id,
      label: room.label,
      name: room.name,
      actions: constants.roomActions,
      devices: modelsBy.Device.room_id[room.id]?.map((device) => (
        fn.filterObjectProperties(device, constants.deviceProps)
      )) || [],
    }))
  ));

  returnObj.getScenesConfig = (modelsBy) => (
    Object.fromEntries(Object.entries(modelsBy.Scene.name).flatMap(([sceneName, scenesByName]) => (
      scenesByName.map((scene) => ([
        sceneName, {
          ...scene,
          sceneActions: modelsBy.SceneAction.scene_id[scene.id].map((sceneAction) => ({
            ...sceneAction,
            [sceneAction.model]: modelsBy?.[fn.pascalCase(sceneAction.model)]?.id?.[sceneAction.model_id]?.[0],
          })),
        },
      ]))
    )))
  );

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
      return models[modelName].findOne({
        where: {
          ...convertFilterToSequelizeWhere(filter),
          active: true,
        },
        raw: true,
      });
    }

    throw new Error(`Could not find model ${modelName}`);
  };

  returnObj.findAll = async (modelName, filter) => {
    const {
      data,
      models,
    } = global;

    const useCache = ['1', 'true'].includes(process.env.USE_CACHE);
    if (useCache) {
      if (data[modelName]) {
        return data[modelName].filter((instance) => processFilter(filter, instance));
      }

      throw new Error(`Could not find model ${modelName}`);
    } else if (models[modelName]) {
      return models[modelName].findAll({
        where: {
          ...convertFilterToSequelizeWhere(filter),
          active: true,
        },
        raw: true,
      });
    }

    throw new Error(`Could not find model ${modelName}`);
  };

  return returnObj;
};
