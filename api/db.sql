
-- User accounts, both for delivering and recieving jobs
CREATE TABLE Users (
    userId BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(48) UNIQUE NOT NULL,
    passwordHash CHAR(128) NOT NULL,
    creationTs BIGINT NOT NULL,
    email VARCHAR(100) UNIQUE,
);

-- Functions are a classification of similar tasks which use the same scripts
CREATE TABLE Functions (
    functionId CHAR(36) PRIMARY KEY,
    userId BIGINT REFERENCES Users,                         -- user who created this function
    name VARCHAR(128) NOT NULL,
    creationTs BIGINT NOT NULL,

    -- Distribution Policy
    --  some use cases want more spread out requests
    --  other use cases it's better to have same worker perform all requests
    policy ENUM('SPREAD', 'LATENCY') default 'LATENCY'
);

-- Uploaded files relevant to function (ie - source)
-- <...>/<functionId>/<fileName>
CREATE TABLE FunctionAssets (
    functionId CHAR(36) REFERENCES Functions,
    assetId BIGINT PRIMARY KEY AUTO_INCREMENT,
    contents LONGBLOB NOT NULL,
    fileName VARCHAR(64) NOT NULL,
    creationTs BIGINT NOT NULL,
);

