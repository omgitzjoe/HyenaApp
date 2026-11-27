-- Optional category bootstrap for a fresh schema; startup migration 010 also ensures these choices.
BEGIN;
INSERT INTO categories(slug, name, id) VALUES
    ('entertainment', 'Entertainment', '38d06ae2-3b31-5827-87de-26ebfc42394b'),
    ('arts', 'Arts', '5757c923-65a6-5d02-81e0-55991a596f1a'),
    ('fitness', 'Fitness', 'a1b8987f-0634-4c18-beb2-adf278429aea'),
    ('food', 'Food', '955c125a-00d4-5731-be1c-b06c9ba92710'),
    ('family', 'Family', 'b995eb5e-188f-5308-a931-ae257f38f8e8'),
    ('other', 'Other', 'e9d8a249-4259-4b2f-93dc-d75876f293da')
ON CONFLICT DO NOTHING;
COMMIT;
