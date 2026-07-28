CREATE TABLE IF NOT EXISTS orders (
  order_id UUID PRIMARY KEY,
  customer_id TEXT NOT NULL,
  order_date TIMESTAMP NOT NULL,
  order_amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);

CREATE TABLE IF NOT EXISTS rejected_orders (
  raw_row JSONB,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now()
);

