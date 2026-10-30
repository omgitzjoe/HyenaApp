CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_zone TEXT,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    description TEXT,
    address TEXT NOT NULL CHECK (btrim(address) <> ''),
    city TEXT NOT NULL CHECK (btrim(city) <> ''),
    region TEXT,
    postal_code TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    phone TEXT,
    website_url TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_business_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR
        (
            latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90
            AND longitude BETWEEN -180 AND 180
        )
    )
);
CREATE TABLE experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    description TEXT NOT NULL CHECK (btrim(description) <> ''),
    type TEXT NOT NULL CHECK (type IN ('OFFER', 'EVENT', 'ACTIVITY', 'SPECIAL')),
    price_amount NUMERIC(10,2) CHECK (price_amount >= 0),
    currency CHAR(3),
    price_label TEXT,
    requirements TEXT,
    image_url TEXT,
    source_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT price_requires_currency CHECK (
        price_amount IS NULL
        OR (currency IS NOT NULL AND btrim(currency) <> '')
    )
);
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> ''),
    slug TEXT NOT NULL UNIQUE CHECK (btrim(slug) <> ''),
    icon_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE experience_categories (
    experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (experience_id, category_id)
);
CREATE TABLE experience_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id UUID NOT NULL UNIQUE REFERENCES experiences(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('ONCE', 'WEEKLY')),
    start_date DATE NOT NULL,
    end_date DATE,
    start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE NOT NULL,
    ends_next_day BOOLEAN NOT NULL DEFAULT FALSE,
    all_day BOOLEAN NOT NULL DEFAULT FALSE,
    time_zone TEXT NOT NULL CHECK (btrim(time_zone) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_schedule_dates CHECK (
        end_date IS NULL OR end_date >= start_date
    ),
    CONSTRAINT valid_once_schedule CHECK (
        kind <> 'ONCE'
        OR (end_date IS NOT NULL AND end_date = start_date)
    ),
    CONSTRAINT valid_all_day CHECK (NOT all_day OR (start_time=TIME '00:00' AND end_time=TIME '23:59' AND ends_next_day=FALSE)),
    CONSTRAINT valid_schedule_times CHECK (
        (ends_next_day = FALSE AND end_time > start_time)
        OR (ends_next_day = TRUE AND end_time <= start_time)
    )
);
CREATE TABLE experience_schedule_days (
    schedule_id UUID NOT NULL REFERENCES experience_schedules(id) ON DELETE CASCADE,
    iso_weekday SMALLINT NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
    PRIMARY KEY (schedule_id, iso_weekday)
);
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    password_hash TEXT NOT NULL CHECK (btrim(password_hash) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT normalized_user_email CHECK (
        email = lower(btrim(email)) AND email <> ''
    )
);
CREATE TABLE saved_experiences (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, experience_id)
);
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE CHECK (btrim(token_hash) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT valid_session_expiration CHECK (
        expires_at > created_at
    ),
    CONSTRAINT valid_session_revocation CHECK (
        revoked_at IS NULL OR revoked_at >= created_at
    )
);
CREATE INDEX idx_businesses_coordinates_active
ON businesses (latitude, longitude) WHERE is_active = TRUE;
CREATE INDEX idx_experiences_business_active
ON experiences (business_id, is_active);
CREATE INDEX idx_experience_categories_category
ON experience_categories (category_id, experience_id);
CREATE INDEX idx_sessions_user
ON sessions (user_id);
CREATE INDEX idx_saved_experiences_user_created
ON saved_experiences (user_id, created_at DESC, experience_id);