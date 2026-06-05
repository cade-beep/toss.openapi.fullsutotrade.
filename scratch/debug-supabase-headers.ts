import { createClient } from '@supabase/supabase-js';

const client = createClient('https://mock.supabase.co', 'mock-key', {
  global: {
    headers: {
      Authorization: 'Bearer mock-jwt-token'
    }
  }
});

console.log("=== CLIENT KEYS ===");
console.log(Object.keys(client));

console.log("=== REST Client ===");
const rest = (client as any).rest;
if (rest) {
  console.log("Rest keys:", Object.keys(rest));
  console.log("Rest headers:", rest.headers);
} else {
  console.log("client.rest is undefined");
}
