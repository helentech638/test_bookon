/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Create activity_types table
  await knex.schema.createTable('activity_types', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.text('description');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['is_active']);
    table.index(['name']);
  });

  // Add activity_type_id column to activities table
  await knex.schema.alterTable('activities', function(table) {
    table.uuid('activity_type_id').references('id').inTable('activity_types').onDelete('SET NULL');
    table.index(['activity_type_id']);
  });

  // Insert some default activity types
  await knex('activity_types').insert([
    { name: 'Sports', description: 'Physical activities and sports' },
    { name: 'Arts & Crafts', description: 'Creative and artistic activities' },
    { name: 'Academic', description: 'Educational and learning activities' },
    { name: 'Music', description: 'Musical activities and lessons' },
    { name: 'Dance', description: 'Dance classes and performances' },
    { name: 'After School Club', description: 'After school care and activities' },
    { name: 'Breakfast Club', description: 'Morning care and activities' },
    { name: 'Holiday Club', description: 'Holiday period activities' },
    { name: 'Other', description: 'Other types of activities' }
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Remove activity_type_id column from activities table
  await knex.schema.alterTable('activities', function(table) {
    table.dropIndex(['activity_type_id']);
    table.dropColumn('activity_type_id');
  });

  // Drop activity_types table
  await knex.schema.dropTable('activity_types');
};

