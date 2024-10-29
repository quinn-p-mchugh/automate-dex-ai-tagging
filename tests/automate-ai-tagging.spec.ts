import { test } from '@playwright/test';
import { chromium, errors } from 'playwright';
import * as fs from 'fs';
import { parse } from 'csv-parse';

/**
 * Read the CSV file and return an array of records.
 *
 * @param {string} filePath - Path to the CSV file.
 * @returns {Promise<any[]>} - A promise that resolves to an array of records.
 */
async function readCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const records: any[] = [];

    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on('data', (data) => records.push(data))
      .on('end', () => resolve(records))
      .on('error', (err) => reject(err));
  });
}

test('Login and AI auto tag all contacts', async () => {
  const filePath = './dex_contacts.csv';
  
  const contacts = await readCSV(filePath);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://getdex.com/login');
  console.log('Waiting for manual login... Please login using your Dex credentials.');
  await page.pause();

  for (const contact of contacts) {
    const userId: string = contact.id;

    const url = `https://getdex.com/contacts/details/${userId}`;
    await page.goto(url);
    console.log(`Opening contact page for user with ID: ${userId}`)

    const aiAutoTagLink = page.locator('a:has-text("AI Auto-tag")');
    await aiAutoTagLink.waitFor({ state: 'visible' });
    await aiAutoTagLink.click();

    const spinner = page.locator('svg.fa-spinner-third.mr-1');
    await spinner.waitFor({ state: 'visible' });
    try {
      await spinner.waitFor({ state: 'hidden', timeout: 30000});
      console.log(`AI tags added for user with ID: ${userId}`);
    }
    catch (error) {
      if (error instanceof errors.TimeoutError) {
        console.log(`Spinner timeout reached - AI tags for contact ${userId} are taking too long to return. Continuing to next contact...`);
        continue;
      } else {
        throw error;
      }
    }

    await page.waitForTimeout(1000); // Delay to allow AI tags to be added before new contact page is opened
  }
});
