CREATE TABLE IF NOT EXISTS attributes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

INSERT IGNORE INTO attributes (name, created_at, updated_at)
VALUES ('Size', NOW(), NOW()), ('Color', NOW(), NOW());
