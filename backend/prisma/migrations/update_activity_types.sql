-- Update activity types to only include Activity, Holiday Club, and Wraparound Care

-- First, deactivate all existing activity types
UPDATE activity_types SET is_active = false;

-- Insert the three allowed activity types
INSERT INTO activity_types (id, name, description, is_active, created_at, updated_at) VALUES 
(gen_random_uuid(), 'Activity', 'General activities and programs', true, NOW(), NOW()),
(gen_random_uuid(), 'Holiday Club', 'Holiday period activities and care', true, NOW(), NOW()),
(gen_random_uuid(), 'Wraparound Care', 'Before and after school care services', true, NOW(), NOW());

