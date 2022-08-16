const {
  dataFn,
  fn,
  models,
  sequelize,
} = global;

exports.addAlias = async (model, modelId, label, preferred = false, transaction = null) => {
  const slug = fn.slugify(label);

  const existingAlias = await dataFn.findOne('Alias', {
    model,
    model_id: modelId,
    alias: slug,
  });

  if (existingAlias) {
    return {
      error: 'EXISTS',
    };
  }

  let transactionToUse = transaction;
  if (!transaction) {
    transactionToUse = await sequelize.transaction();
  }

  const alias = await models.Alias.create({
    model,
    model_id: modelId,
    alias: slug,
    label,
    preferred,
  }, {
    transaction: transactionToUse,
  });

  return alias;
};

exports.removeAlias = async (aliasId, transaction = null) => {
  let transactionToUse = transaction;
  if (!transaction) {
    transactionToUse = await sequelize.transaction();
  }

  const deleted = await models.Alias.destroy({
    where: {
      id: aliasId,
    },
    transaction: transactionToUse,
  });

  return !!deleted[0];
};

exports.removeAllAliases = async (model, modelId) => {
  const deleted = await models.Alias.destroy({
    where: {
      model,
      model_id: modelId,
    },
  });

  return !!deleted[0];
};
