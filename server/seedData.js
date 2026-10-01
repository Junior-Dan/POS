import { db } from './db.js';

// Intentionally a NO-OP.
//
// This POS is for one real business. The product catalogue, suppliers,
// customers and staff are all created by the owner through the app — the
// system must never inject demo/dummy data. Previously this function seeded a
// sample liquor catalogue (14 products, suppliers, customers, a demo shift,
// etc.) whenever the products table was empty, which reappeared on every fresh
// deploy. That behaviour is removed.
//
// Kept as an exported function so existing imports/callers keep working.
export function seedDatabase() {
  return;
}
