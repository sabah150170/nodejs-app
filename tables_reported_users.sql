CREATE TYPE gender_type AS ENUM ('Male', 'Female');

CREATE TABLE registered_user (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    tc NUMERIC(11, 0),
    date_of_birth DATE,
    gender gender_type NOT NULL,
    is_military BOOLEAN,
    military_date NUMERIC(4,0),
    phone_number NUMERIC(15, 0),
    email VARCHAR(100) UNIQUE NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE OR REPLACE FUNCTION check_military_conditions()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if gender is Male and is_military is NULL
    IF NEW.gender = 'Male' AND NEW.is_military IS NULL THEN
        RAISE EXCEPTION 'is_military must not be NULL for Male users';
    END IF;

    -- Check if is_military is TRUE and date_of_birth is NULL
    IF NEW.is_military = TRUE AND NEW.military_date IS NULL THEN
        RAISE EXCEPTION 'military_date cannot be empty if is_military is TRUE';
    END IF;

    RETURN NEW; -- Return the new record
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_military_before_insert
BEFORE INSERT ON registered_user
FOR EACH ROW
EXECUTE FUNCTION check_military_conditions();