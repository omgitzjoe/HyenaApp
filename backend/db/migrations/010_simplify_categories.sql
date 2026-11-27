BEGIN;

-- Prefer existing IDs for categories we are keeping so saved filters keep working.
CREATE TEMP TABLE category_targets (
    slug TEXT PRIMARY KEY, name TEXT NOT NULL, fallback_id UUID NOT NULL, category_id UUID
) ON COMMIT DROP;
INSERT INTO category_targets(slug, name, fallback_id) VALUES
    ('entertainment', 'Entertainment', '38d06ae2-3b31-5827-87de-26ebfc42394b'),
    ('arts', 'Arts', '5757c923-65a6-5d02-81e0-55991a596f1a'),
    ('fitness', 'Fitness', 'a1b8987f-0634-4c18-beb2-adf278429aea'),
    ('food', 'Food', '955c125a-00d4-5731-be1c-b06c9ba92710'),
    ('family', 'Family', 'b995eb5e-188f-5308-a931-ae257f38f8e8'),
    ('other', 'Other', 'e9d8a249-4259-4b2f-93dc-d75876f293da');

UPDATE category_targets t SET category_id = (
    SELECT c.id FROM categories c
    WHERE lower(btrim(c.slug)) IN (t.slug, 'hyena-seed-' || t.slug)
        OR (lower(btrim(c.name)) = lower(t.name) AND NOT EXISTS (
            SELECT 1 FROM category_targets other
            WHERE lower(btrim(c.slug)) IN (other.slug, 'hyena-seed-' || other.slug)
        ))
    ORDER BY (c.slug = t.slug) DESC, (c.name = t.name) DESC, (c.id = t.fallback_id) DESC, c.id
    LIMIT 1
);
INSERT INTO categories(id, name, slug)
SELECT fallback_id, 'hyena-category-' || fallback_id, slug FROM category_targets WHERE category_id IS NULL;
UPDATE category_targets SET category_id = fallback_id WHERE category_id IS NULL;

CREATE TEMP TABLE category_remap ON COMMIT DROP AS
SELECT c.id AS old_id, COALESCE(kept.category_id, target.category_id) AS new_id
FROM categories c
LEFT JOIN category_targets kept ON kept.category_id = c.id
JOIN category_targets target ON target.slug = CASE
    WHEN c.slug ~ '^(hyena-seed-)?(entertainment|music|concerts?|games?|movies?|films?|cinema|date-night)$'
        OR c.name ~* '^(entertainment|music|concerts?|games?|movies?|films?|cinema|date night)$' THEN 'entertainment'
    WHEN c.slug ~ '^(hyena-seed-)?(arts?|crafts?|culture|theat(er|re))$'
        OR c.name ~* '^(arts?|crafts?|culture|theat(er|re))$' THEN 'arts'
    WHEN c.slug ~ '^(hyena-seed-)?(fitness|sports?|outdoors?|wellness|recreation)$'
        OR c.name ~* '^(fitness|sports?|outdoors?|wellness|recreation)$' THEN 'fitness'
    WHEN c.slug ~ '^(hyena-seed-)?(food|dining|drinks?)$'
        OR c.name ~* '^(food|dining|drinks?)$' THEN 'food'
    WHEN c.slug ~ '^(hyena-seed-)?(family|kids|seasonal|holidays?)$'
        OR c.name ~* '^(family|kids|seasonal|holidays?)$' THEN 'family'
    ELSE 'other'
END;
CREATE UNIQUE INDEX ON category_remap(old_id);

INSERT INTO experience_categories(experience_id, category_id)
SELECT ec.experience_id, m.new_id
FROM experience_categories ec JOIN category_remap m ON ec.category_id = m.old_id
WHERE m.old_id <> m.new_id
ON CONFLICT DO NOTHING;

-- Reviewable payloads must refer to selectable categories. Keep the original
-- request_payload unchanged so identical submission retries still get a receipt.
WITH remapped AS (
    SELECT s.id, COALESCE((
        SELECT jsonb_agg(DISTINCT COALESCE(m.new_id, fallback.category_id)
                         ORDER BY COALESCE(m.new_id, fallback.category_id))
        FROM jsonb_array_elements_text(CASE
            WHEN jsonb_typeof(s.payload#>'{event,categoryIds}') = 'array' THEN s.payload#>'{event,categoryIds}'
            ELSE '[]'::jsonb END) AS a(old_id)
        LEFT JOIN category_remap m ON m.old_id::text = lower(a.old_id)
    ), '[]'::jsonb) AS category_ids
    FROM event_submissions s CROSS JOIN category_targets fallback
    WHERE fallback.slug = 'other' AND jsonb_typeof(s.payload#>'{event,categoryIds}') = 'array'
)
UPDATE event_submissions s
SET payload = jsonb_set(s.payload, '{event,categoryIds}', remapped.category_ids), revision = s.revision + 1
FROM remapped WHERE s.id = remapped.id AND s.payload#>'{event,categoryIds}' <> remapped.category_ids;

DELETE FROM experience_categories ec USING category_remap m
WHERE ec.category_id = m.old_id AND m.old_id <> m.new_id;
DELETE FROM categories c USING category_remap m
WHERE c.id = m.old_id AND m.old_id <> m.new_id;

-- Avoid unique-name collisions while renaming retained categories.
UPDATE categories c SET name = 'hyena-category-' || c.id
FROM category_targets t WHERE c.id = t.category_id AND c.name <> t.name;
UPDATE categories c SET name = t.name, slug = t.slug
FROM category_targets t WHERE c.id = t.category_id;

COMMIT;
