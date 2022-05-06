exports.seed = (knex) =>
  knex('state')
    .insert([{ id: 1, data: null }])
    .onConflict('id')
    .merge();
