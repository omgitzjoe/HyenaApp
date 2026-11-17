-- Current Hyena schema after migration 008. Reference only; use versioned migrations for upgrades.

CREATE TABLE admin_sessions (
    token_hash character(64) NOT NULL,
    username text NOT NULL,
    credential_version character(64) NOT NULL,
    csrf_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT admin_sessions_created_at_not_null NOT NULL created_at,
    CONSTRAINT admin_sessions_credential_version_not_null NOT NULL credential_version,
    CONSTRAINT admin_sessions_csrf_token_not_null NOT NULL csrf_token,
    CONSTRAINT admin_sessions_expires_at_not_null NOT NULL expires_at,
    CONSTRAINT admin_sessions_pkey PRIMARY KEY (token_hash),
    CONSTRAINT admin_sessions_token_hash_not_null NOT NULL token_hash,
    CONSTRAINT admin_sessions_username_not_null NOT NULL username
);

CREATE TABLE businesses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    address text,
    city text,
    state text,
    postal_code text,
    latitude numeric(9,6),
    longitude numeric(9,6),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT businesses_address_check CHECK ((btrim(address) <> ''::text)),
    CONSTRAINT businesses_city_check CHECK ((btrim(city) <> ''::text)),
    CONSTRAINT businesses_created_at_not_null NOT NULL created_at,
    CONSTRAINT businesses_id_not_null NOT NULL id,
    CONSTRAINT businesses_is_active_not_null NOT NULL is_active,
    CONSTRAINT businesses_name_check CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT businesses_name_not_null NOT NULL name,
    CONSTRAINT businesses_pkey PRIMARY KEY (id),
    CONSTRAINT businesses_updated_at_not_null NOT NULL updated_at,
    CONSTRAINT valid_business_coordinates CHECK ((((latitude IS NULL) AND (longitude IS NULL)) OR ((latitude IS NOT NULL) AND (longitude IS NOT NULL) AND ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)) AND ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))))),
    CONSTRAINT venue_location_required CHECK (((NOT is_active) OR (((city IS NOT NULL) AND (btrim(city) <> ''::text) AND (state IS NOT NULL) AND (btrim(state) <> ''::text)) OR ((latitude IS NOT NULL) AND (longitude IS NOT NULL)))))
);

CREATE TABLE categories (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL,
    icon_key text,
    CONSTRAINT categories_id_not_null NOT NULL id,
    CONSTRAINT categories_name_check CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT categories_name_key UNIQUE (name),
    CONSTRAINT categories_name_not_null NOT NULL name,
    CONSTRAINT categories_pkey PRIMARY KEY (id),
    CONSTRAINT categories_slug_check CHECK ((btrim(slug) <> ''::text)),
    CONSTRAINT categories_slug_key UNIQUE (slug),
    CONSTRAINT categories_slug_not_null NOT NULL slug
);

CREATE TABLE event_reports (
    id uuid NOT NULL,
    experience_id uuid NOT NULL,
    reason text NOT NULL,
    details text NOT NULL DEFAULT ''::text,
    status text NOT NULL DEFAULT 'OPEN'::text,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp with time zone,
    reviewed_by text,
    CONSTRAINT event_reports_created_at_not_null NOT NULL created_at,
    CONSTRAINT event_reports_details_check CHECK ((length(details) <= 1000)),
    CONSTRAINT event_reports_details_not_null NOT NULL details,
    CONSTRAINT event_reports_experience_id_fkey FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE,
    CONSTRAINT event_reports_experience_id_not_null NOT NULL experience_id,
    CONSTRAINT event_reports_id_not_null NOT NULL id,
    CONSTRAINT event_reports_pkey PRIMARY KEY (id),
    CONSTRAINT event_reports_reason_check CHECK ((reason = ANY (ARRAY['CANCELLED'::text, 'WRONG_TIME'::text, 'WRONG_LOCATION'::text, 'WRONG_PRICE'::text, 'OTHER'::text]))),
    CONSTRAINT event_reports_reason_not_null NOT NULL reason,
    CONSTRAINT event_reports_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'RESOLVED'::text]))),
    CONSTRAINT event_reports_status_not_null NOT NULL status
);

CREATE TABLE event_submissions (
    id uuid NOT NULL,
    client_request_id uuid NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'PENDING'::text,
    published_experience_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp with time zone,
    reviewed_by text,
    auto_publish_blocked boolean NOT NULL DEFAULT false,
    source_kind text NOT NULL DEFAULT 'USER'::text,
    request_payload jsonb,
    revision integer NOT NULL DEFAULT 0,
    duplicate_of uuid,
    CONSTRAINT event_submissions_auto_publish_blocked_not_null NOT NULL auto_publish_blocked,
    CONSTRAINT event_submissions_client_request_id_key UNIQUE (client_request_id),
    CONSTRAINT event_submissions_client_request_id_not_null NOT NULL client_request_id,
    CONSTRAINT event_submissions_created_at_not_null NOT NULL created_at,
    CONSTRAINT event_submissions_duplicate_of_fkey FOREIGN KEY (duplicate_of) REFERENCES experiences(id) ON DELETE SET NULL,
    CONSTRAINT event_submissions_id_not_null NOT NULL id,
    CONSTRAINT event_submissions_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT event_submissions_payload_not_null NOT NULL payload,
    CONSTRAINT event_submissions_pkey PRIMARY KEY (id),
    CONSTRAINT event_submissions_published_experience_id_fkey FOREIGN KEY (published_experience_id) REFERENCES experiences(id) ON DELETE RESTRICT,
    CONSTRAINT event_submissions_published_experience_id_key UNIQUE (published_experience_id),
    CONSTRAINT event_submissions_revision_not_null NOT NULL revision,
    CONSTRAINT event_submissions_source_kind_check CHECK ((source_kind = ANY (ARRAY['USER'::text, 'FEED'::text]))),
    CONSTRAINT event_submissions_source_kind_not_null NOT NULL source_kind,
    CONSTRAINT event_submissions_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text]))),
    CONSTRAINT event_submissions_status_not_null NOT NULL status,
    CONSTRAINT valid_submission_review CHECK ((((status = 'PENDING'::text) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL) AND (published_experience_id IS NULL)) OR ((status = 'APPROVED'::text) AND (reviewed_at IS NOT NULL) AND (NULLIF(btrim(reviewed_by), ''::text) IS NOT NULL) AND (published_experience_id IS NOT NULL)) OR ((status = 'REJECTED'::text) AND (reviewed_at IS NOT NULL) AND (NULLIF(btrim(reviewed_by), ''::text) IS NOT NULL) AND (published_experience_id IS NULL))))
);

CREATE TABLE experience_categories (
    experience_id uuid NOT NULL,
    category_id uuid NOT NULL,
    CONSTRAINT experience_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CONSTRAINT experience_categories_category_id_not_null NOT NULL category_id,
    CONSTRAINT experience_categories_experience_id_fkey FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE,
    CONSTRAINT experience_categories_experience_id_not_null NOT NULL experience_id,
    CONSTRAINT experience_categories_pkey PRIMARY KEY (experience_id, category_id)
);

CREATE TABLE experience_schedule_days (
    iso_weekday smallint NOT NULL,
    experience_id uuid NOT NULL,
    CONSTRAINT experience_schedule_days_experience_id_fkey FOREIGN KEY (experience_id) REFERENCES experience_schedules(experience_id) ON DELETE CASCADE,
    CONSTRAINT experience_schedule_days_experience_id_not_null NOT NULL experience_id,
    CONSTRAINT experience_schedule_days_iso_weekday_check CHECK (((iso_weekday >= 1) AND (iso_weekday <= 7))),
    CONSTRAINT experience_schedule_days_iso_weekday_not_null NOT NULL iso_weekday,
    CONSTRAINT experience_schedule_days_pkey PRIMARY KEY (experience_id, iso_weekday)
);

CREATE TABLE experience_schedules (
    experience_id uuid NOT NULL,
    kind text NOT NULL DEFAULT 'ONCE'::text,
    start_date date NOT NULL,
    end_date date,
    start_time time without time zone,
    end_time time without time zone,
    all_day boolean NOT NULL DEFAULT false,
    time_zone text,
    CONSTRAINT experience_schedules_all_day_not_null NOT NULL all_day,
    CONSTRAINT experience_schedules_experience_id_fkey FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE,
    CONSTRAINT experience_schedules_experience_id_not_null NOT NULL experience_id,
    CONSTRAINT experience_schedules_kind_check CHECK ((kind = ANY (ARRAY['ONCE'::text, 'WEEKLY'::text]))),
    CONSTRAINT experience_schedules_kind_not_null NOT NULL kind,
    CONSTRAINT experience_schedules_pkey PRIMARY KEY (experience_id),
    CONSTRAINT experience_schedules_start_date_not_null NOT NULL start_date,
    CONSTRAINT experience_schedules_time_zone_check CHECK ((btrim(time_zone) <> ''::text)),
    CONSTRAINT schedule_end_valid CHECK ((all_day OR (end_time IS NULL) OR (kind = 'WEEKLY'::text) OR (COALESCE(end_date, start_date) > start_date) OR (end_time > start_time))),
    CONSTRAINT schedule_start_required CHECK ((all_day OR (start_time IS NOT NULL))),
    CONSTRAINT valid_schedule_dates CHECK (((end_date IS NULL) OR (end_date >= start_date)))
);

CREATE TABLE experiences (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    type text NOT NULL DEFAULT 'OTHER'::text,
    price_amount numeric(10,2),
    source_url text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT experiences_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE RESTRICT,
    CONSTRAINT experiences_business_id_not_null NOT NULL business_id,
    CONSTRAINT experiences_created_at_not_null NOT NULL created_at,
    CONSTRAINT experiences_description_check CHECK ((btrim(description) <> ''::text)),
    CONSTRAINT experiences_id_not_null NOT NULL id,
    CONSTRAINT experiences_is_active_not_null NOT NULL is_active,
    CONSTRAINT experiences_pkey PRIMARY KEY (id),
    CONSTRAINT experiences_price_amount_check CHECK ((price_amount >= (0)::numeric)),
    CONSTRAINT experiences_title_check CHECK ((btrim(title) <> ''::text)),
    CONSTRAINT experiences_title_not_null NOT NULL title,
    CONSTRAINT experiences_type_check CHECK ((type = ANY (ARRAY['OTHER'::text, 'OFFER'::text, 'EVENT'::text, 'ACTIVITY'::text, 'SPECIAL'::text]))),
    CONSTRAINT experiences_type_not_null NOT NULL type,
    CONSTRAINT experiences_updated_at_not_null NOT NULL updated_at
);

CREATE TABLE schema_migrations (
    name text NOT NULL,
    applied_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT schema_migrations_applied_at_not_null NOT NULL applied_at,
    CONSTRAINT schema_migrations_name_not_null NOT NULL name,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY (name)
);

CREATE TABLE venue_lookup_cache (
    query text NOT NULL,
    results jsonb NOT NULL,
    checked_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT venue_lookup_cache_checked_at_not_null NOT NULL checked_at,
    CONSTRAINT venue_lookup_cache_expires_at_not_null NOT NULL expires_at,
    CONSTRAINT venue_lookup_cache_pkey PRIMARY KEY (query),
    CONSTRAINT venue_lookup_cache_query_not_null NOT NULL query,
    CONSTRAINT venue_lookup_cache_results_not_null NOT NULL results
);
