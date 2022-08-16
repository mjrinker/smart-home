const {
  _,
  dataFn,
} = global;

const flattenGroups = async (groups) => {
  const flattenedGroups = [...groups];
  // eslint-disable-next-line camelcase
  const groupModels = await dataFn.findAll('GroupModel', { group_id: groups.map((group) => group.id) });

  const groupGroups = groupModels?.length > 0 ? groupModels.filter((groupModel) => groupModel.model === 'group') : [];
  if (groupGroups.length > 0) {
    // eslint-disable-next-line camelcase
    const subGroups = await dataFn.findAll('Group', { id: groupGroups.map((groupModel) => groupModel.model_id) });
    flattenedGroups.push(...(await flattenGroups(subGroups)));
  }

  return _.uniqBy(flattenedGroups, 'id');
};

exports.flattenGroups = flattenGroups;
