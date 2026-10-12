ALTER TABLE "addresses" ADD COLUMN "location_pin" JSONB;

ALTER TABLE "addresses" ADD CONSTRAINT "addresses_location_pin_shape" CHECK (
    "location_pin" IS NULL OR (
        jsonb_typeof("location_pin") = 'object'
        AND jsonb_typeof("location_pin"->'latitude') = 'number'
        AND jsonb_typeof("location_pin"->'longitude') = 'number'
        AND ("location_pin"->>'latitude')::double precision BETWEEN -90 AND 90
        AND ("location_pin"->>'longitude')::double precision BETWEEN -180 AND 180
        AND (
            NOT "location_pin" ? 'accuracyMeters'
            OR (
                jsonb_typeof("location_pin"->'accuracyMeters') = 'number'
                AND ("location_pin"->>'accuracyMeters')::double precision BETWEEN 0 AND 100000
            )
        )
        AND ("location_pin" - 'latitude' - 'longitude' - 'accuracyMeters') = '{}'::jsonb
    )
);
