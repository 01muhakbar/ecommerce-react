CREATE TABLE IF NOT EXISTS attribute_values (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attribute_id INT UNSIGNED NOT NULL,
  value VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_attribute_value (attribute_id, value),
  INDEX idx_attribute_id (attribute_id),
  CONSTRAINT fk_attribute_values_attribute
    FOREIGN KEY (attribute_id) REFERENCES attributes(id)
    ON DELETE CASCADE
);
