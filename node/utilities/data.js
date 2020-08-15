module.exports = (envVars) => {
  const returnObj = {};

  const {
    DataTypes,
    fn,
    fs,
    Model,
    path,
    sequelize,
  } = envVars;

  returnObj.getModelsBy = async (models) => (
    (await models._map(async (model, modelName) => {
      const rawAttributes = model.rawAttributes._keys();
      const instances = await model.findAll({
        ...(rawAttributes.includes('active') ? { where: { active: true } } : {}),
        ...(rawAttributes.includes('order') ? { order: ['order'] } : {}),
        raw: true,
      });

      const modelBy = rawAttributes._map((attribute) => {
        const groupByCallback = attribute === 'model_id' ? (instance) => `${instance.model}_${instance.model_id}` : attribute;
        const groups = instances._groupBy(groupByCallback);
        return [attribute, groups];
      })._fromPairs();

      return [modelName, modelBy];
    }))._fromPairs()
  );

  returnObj.getAliasesConfig = (modelsBy) => (
    modelsBy.Alias.alias._map((aliasObjects, alias) => [
      alias,
      aliasObjects._filterMap(
        (aliasObject) => (
          aliasObject.model !== 'room'
          && modelsBy._get([aliasObject.model._pascalCase(), 'id', aliasObject.model_id, 'length']) > 0
        ),
        (aliasObject) => (
          modelsBy[aliasObject.model._pascalCase()].id[aliasObject.model_id][0].name
        ),
      ),
    ]).filter(([, modelNames]) => modelNames.length > 0)
  );

  returnObj.getColorsConfig = (modelsBy) => (
    modelsBy.Color.name._map((colorsByName, name) => {
      const color = colorsByName[0];
      return [
        name, {
          label: color.label,
          value: color.value,
          displayValue: color.display_value,
        },
      ];
    })._fromPairs()
  );

  returnObj.getDeviceConfig = (modelsBy) => {
    const groupsConfig = returnObj.getGroupsConfig(modelsBy);
    const aliasesConfig = returnObj.getAliasesConfig(modelsBy);
    const groupsAliasesConfig = groupsConfig._concat(aliasesConfig)._groupBy(0)
      ._entries()
      ._map(([, pairs]) => (
        pairs._reduce((acc, pair) => {
          acc[pair[0]] = (acc[pair[0]] || [])._concat(pair[1]);
          return acc;
        }, {})._toPairs()
      ))
      ._flatten();

    return groupsAliasesConfig._concat(
      modelsBy.Device.name._flatMap((devicesByName, deviceName) => (
        devicesByName._map((device) => {
          const groupModels = modelsBy.GroupModel.model_id[`device_${device.id}`] || [];
          const deviceGroups = groupModels._flatMap((groupModel) => (
            modelsBy.Group.id[groupModel.group_id]
          ));

          const devicePresets = ((modelsBy.Preset.model_id[`device_${device.id}`] || [])._concat(
            (
              deviceGroups._flatMap((group) => (
                modelsBy.Preset.model_id[`group_${group.id}`]
              )) || []
            ),
            (
              modelsBy.Preset.model_id[`room_${device.room_id}`] || []
            ),
          ))._flatMap();

          const deviceConditionalActions = ((modelsBy.ConditionalAction.model_id[`device_${device.id}`] || [])._concat(
            (
              deviceGroups._flatMap((group) => (
                modelsBy.ConditionalAction.model_id[`group_${group.id}`]
              )) || []),
            (
              modelsBy.ConditionalAction.model_id[`room_${device.room_id}`] || []
            ),
          ) || [])._groupBy('action');

          return [
            deviceName,
            {
              ...device,
              ...(devicePresets ? {
                presets: devicePresets._filterMap(
                  (preset) => preset,
                  (preset) => {
                    const presetActions = (modelsBy.PresetAction.preset_id[preset.id] || [])._map(
                      (presetAction) => [
                        presetAction.action,
                        fn.castActionValue(presetAction.value, presetAction.datatype),
                      ],
                    )._fromPairs();

                    return [preset.name, presetActions];
                  },
                )._fromPairs(),
              } : {}),
              ...(deviceConditionalActions ? {
                timeBased: deviceConditionalActions._map((conditionalActions, action) => {
                  const scheduledPresets = conditionalActions._filterMap({ condition_type: 'time' }, (conditionalAction) => {
                    const presetName = modelsBy.Preset.id._get([conditionalAction.preset_id, 0, 'name']);
                    return [conditionalAction.condition || 'default', presetName];
                  })._fromPairs();
                  return [action, scheduledPresets];
                })._filter(([action]) => action !== 'undefined')._fromPairs(),
              } : {}),
            },
          ];
        })
      )),
    )._fromPairs();
  };

  returnObj.getGroupsConfig = (modelsBy) => (
    modelsBy.Group.name._flatMap((groupObjects, groupName) => (
      groupObjects._filterMap(
        (group) => modelsBy._get(['GroupModel', 'group_id', group.id, 'length']) > 0,
        (group) => [
          groupName,
          modelsBy.GroupModel.group_id[group.id]._filterMap(
            (groupModel) => (
              groupModel.model !== 'room'
              && modelsBy._get([groupModel.model._pascalCase(), 'id', groupModel.model_id, 'length']) > 0
            ),
            (groupModel) => (
              modelsBy[groupModel.model._pascalCase()].id[groupModel.model_id][0].name
            ),
          ),
        ],
      )
    ))
  );

  returnObj.getRoomsConfig = (modelsBy) => (
    modelsBy.Room.id._values()._flatMap((roomsById) => (
      roomsById._map((room) => ({
        label: room.label,
        name: room.name,
        actions: [
          {
            action: 'off',
            value: true,
          },
          {
            action: 'on',
            value: true,
          },
        ],
      }))
    ))
  );

  returnObj.getScenesConfig = (modelsBy) => (
    modelsBy.Scene.name._flatMap((scenesByName, sceneName) => (
      scenesByName._map((scene) => ([
        sceneName, {
          ...scene,
          sceneActions: modelsBy.SceneAction.scene_id[scene.id]._map((sceneAction) => ({
            ...sceneAction,
            [sceneAction.model]: modelsBy._get([sceneAction.model._pascalCase(), 'id', sceneAction.model_id, 0]),
          })),
        },
      ]))
    ))._fromPairs()
  );

  returnObj.loadModels = () => {
    const modelParams = { DataTypes, Model, sequelize };
    return fs.readdirSync(path.join(__dirname, '../models'))
      ._filterMap((file) => file.match(/\.js$/), (file) => [
        file.replace(/\.js$/, ''), // eslint-disable-next-line import/no-dynamic-require, global-require
        require(path.join(__dirname, '../models', file.replace(/\.js$/, '')))(modelParams),
      ])
      ._fromPairs();
  };

  return returnObj;
};
