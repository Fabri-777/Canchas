-- Run once in MySQL Workbench, connected as root (lightning-bolt icon).
-- Creates the database and the user the app connects with.
-- The tables are created by the app on first start (backend/db/tables.py).
-- Local university project: the password matches the one in .env.

CREATE DATABASE IF NOT EXISTS canchas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'canchas_app'@'localhost' IDENTIFIED BY 'canchas123';
CREATE USER IF NOT EXISTS 'canchas_app'@'127.0.0.1' IDENTIFIED BY 'canchas123';

GRANT ALL PRIVILEGES ON canchas.* TO 'canchas_app'@'localhost';
GRANT ALL PRIVILEGES ON canchas.* TO 'canchas_app'@'127.0.0.1';

FLUSH PRIVILEGES;
