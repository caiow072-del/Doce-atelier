-- Create a table for secure settings that won't be wiped by Cloudflare
CREATE TABLE IF NOT EXISTS secret_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE secret_settings ENABLE ROW LEVEL SECURITY;

-- Allow reading the gemini key for everyone (needed for the server function using anon key)
CREATE POLICY "Allow public read of gemini key" ON secret_settings
  FOR SELECT USING (key = 'gemini_api_key');

