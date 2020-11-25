const envVars = module.parent.parent.exports;

const {
  fn,
} = envVars;

exports.addAlias = async (model, modelId, label, preferred = false) => {
  const slug = fn.slugify(label);
  const aliasGroup = global.modelsBy.Alias?.model_id[`${model}_${modelId}`];
  if (aliasGroup?.find((alias) => alias?.alias === slug)) {
    return {
      error: 'EXISTS',
    };
  }

  const alias = await global.models.Alias.create({
    model,
    model_id: modelId,
    alias: slug,
    label,
    preferred,
  });

  Object.entries(alias.dataValues).forEach(([field, value]) => {
    const groupByValue = field === 'model_id' ? `${model}_${modelId}` : value;
    const aliasGroups = global.modelsBy.Alias[field];
    if (aliasGroups && aliasGroups[value]) {
      global.modelsBy.Alias[field][groupByValue].push(alias);
    }
  });

  return alias;
};

exports.removeAlias = async (aliasId) => {
  Object.entries(global.modelsBy.Alias).forEach(([field, aliasGroups]) => {
    Object.entries(aliasGroups).forEach(([fieldValue, aliasGroup]) => {
      global.modelsBy.Alias[field][fieldValue] = aliasGroup.filter((alias) => (
        alias.id !== Number(aliasId)
      ));
    });
  });

  const deleted = await global.models.Alias.destroy({
    where: {
      id: aliasId,
    },
  });

  return !!deleted[0];
};

exports.removeAllAliases = async (model, modelId) => {
  const aliasIds = [];
  Object.entries(global.modelsBy.Alias).forEach(([field, aliasGroup]) => {
    global.modelsBy.Alias[field] = aliasGroup.filter((alias) => {
      const isMatch = alias.model === model && alias.model_id === modelId;
      if (isMatch) {
        aliasIds.push(alias.id);
      }

      return !isMatch;
    });
  });

  const deleted = await global.models.Alias.destroy({
    where: {
      id: aliasIds,
    },
  });

  return !!deleted[0];
};
