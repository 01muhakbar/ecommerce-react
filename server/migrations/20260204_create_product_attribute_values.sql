CREATE TABLE IF NOT EXISTS product_attribute_values (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  attribute_id INT UNSIGNED NOT NULL,
  attribute_value_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_product_attribute (product_id, attribute_id),
  INDEX idx_product_id (product_id),
  INDEX idx_attribute_id (attribute_id),
  INDEX idx_value_id (attribute_value_id),
  CONSTRAINT fk_pav_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pav_attribute
    FOREIGN KEY (attribute_id) REFERENCES attributes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pav_value
    FOREIGN KEY (attribute_value_id) REFERENCES attribute_values(id)
    ON DELETE CASCADE
);
