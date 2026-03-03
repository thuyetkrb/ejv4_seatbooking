import { CONFIG } from '../config';

export const googleSheetService = {
  async fetchSheetData(sheetName: string): Promise<any[]> {
    if (!CONFIG.GOOGLE_SCRIPT_URL) {
      console.warn('GOOGLE_SCRIPT_URL is not set. Falling back to public CSV fetch.');
      return this.fetchPublicCSV(sheetName);
    }

    try {
      const url = `${CONFIG.GOOGLE_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch sheet: ${sheetName}`);
      
      const result = await response.json();
      if (result.ok) {
        return result.data || [];
      }
      return [];
    } catch (error) {
      console.error(`Error fetching sheet ${sheetName} via Script:`, error);
      return this.fetchPublicCSV(sheetName);
    }
  },

  async fetchPublicCSV(sheetName: string): Promise<any[]> {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const csvText = await response.text();
      return this.parseCSV(csvText);
    } catch (e) {
      return [];
    }
  },
  
  async saveData(sheetName: string, data: any, action: 'update' | 'append' | 'updatebykey' = 'update', keyName?: string): Promise<boolean> {
    if (!CONFIG.GOOGLE_SCRIPT_URL) {
      console.warn('GOOGLE_SCRIPT_URL is not set. Data will not be saved to Google Sheets.');
      return false;
    }

    try {
      console.log(`Saving data to sheet: ${sheetName} with action: ${action}`, data);
      await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          sheetName,
          action,
          keyName,
          data
        }),
      });
      return true;
    } catch (error) {
      console.error(`Error saving to sheet ${sheetName}:`, error);
      return false;
    }
  },

  parseCSV(csvText: string): any[] {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];

    // Simple CSV parser that handles quotes
    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseLine(lines[i]);
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      data.push(obj);
    }

    return data;
  }
};
