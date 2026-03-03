import { CONFIG } from '../config';

export const googleSheetService = {
  async fetchSheetData(sheetName: string): Promise<any[]> {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch sheet: ${sheetName}`);
      
      const csvText = await response.text();
      return this.parseCSV(csvText);
    } catch (error) {
      console.error(`Error fetching sheet ${sheetName}:`, error);
      return [];
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
