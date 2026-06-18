import fs from 'fs';
import path from 'path';

const CREDENTIALS_FILE = path.join(process.cwd(), 'scratch', 'api_credentials.json');

export interface LocalCredentials {
  user_id: string;
  encrypted_api_key: string;
  encrypted_secret_key: string;
  account_id: string;
  is_simulation: boolean;
  updated_at: string;
}

export function getLocalCredentials(): LocalCredentials | null {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return null;
    }
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to read local credentials:', err);
    return null;
  }
}

export function saveLocalCredentials(creds: LocalCredentials): boolean {
  try {
    const dir = path.dirname(CREDENTIALS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save local credentials:', err);
    return false;
  }
}

export function deleteLocalCredentials(): boolean {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      fs.unlinkSync(CREDENTIALS_FILE);
    }
    return true;
  } catch (err) {
    console.error('Failed to delete local credentials:', err);
    return false;
  }
}
