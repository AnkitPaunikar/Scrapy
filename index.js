import puppeteer from "puppeteer-core";
import xlsx from "xlsx";
import randomUseragent from "random-useragent";
import { promisify } from "util";
import pLimit from "p-limit";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import os from "os";
import fs from "fs";
import { exec as execCb } from "child_process";
import gradient from "gradient-string";
import chalk from "chalk";
import chalkanimation from "chalk-animation";
import figlet from "figlet";

const exec = promisify(execCb);

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("location", {
    describe: "Location for the job search",
    type: "string",
    demandOption: true,
  })
  .option("experience", {
    describe: "Minimum years of experience required",
    type: "number",
    demandOption: true,
  })
  .option("roles", {
    describe: "Job roles to search for (comma-separated)",
    type: "array",
    demandOption: true,
  })
  .option("freshness", {
    describe: "Freshness filter (number of days)",
    type: "number",
    default: 7,
  })
  .option("timeout", {
    describe: "Timeout in minutes",
    type: "number",
    default: 60,
  })
  .option("directory", {
    describe: "Directory to save the Excel file",
    type: "string",
    default: path.join(os.homedir(), "Downloads"),
  })
  .help().argv;

const roles = argv.roles;
const location = argv.location;
const experience = argv.experience;
const freshness = argv.freshness;
const timeLimit = argv.timeout * 60 * 1000;
const saveDirectory = argv.directory;

console.log(experience);

// Create the save directory if it doesn't exist
if (!fs.existsSync(saveDirectory)) {
  fs.mkdirSync(saveDirectory, { recursive: true });
}

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

async function welcome() {
  const msg = "Welcome to the Scraper";
  figlet(msg, (err, data) => {
    if (err) console.error(err);
    console.log(gradient.pastel.multiline(data));
  });
  await sleep();
}

// Function to find the Chrome browser on the system
const findBrowser = async () => {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "google-chrome";
};

// Function to write jobs to an Excel file with retry logic
const writeJobsToExcel = async (jobs, filePath) => {
  const tempFilePath = `${filePath}.tmp`;

  try {
    let wb;
    let ws;

    if (fs.existsSync(filePath)) {
      wb = xlsx.readFile(filePath);
      ws = wb.Sheets["Jobs"];

      if (ws) {
        const existingJobs = xlsx.utils.sheet_to_json(ws);
        const allJobs = [...existingJobs, ...jobs];
        ws = xlsx.utils.json_to_sheet(allJobs);
        wb.Sheets["Jobs"] = ws;
      } else {
        ws = xlsx.utils.json_to_sheet(jobs);
        xlsx.utils.book_append_sheet(wb, ws, "Jobs");
      }
    } else {
      wb = xlsx.utils.book_new();
      ws = xlsx.utils.json_to_sheet(jobs);
      xlsx.utils.book_append_sheet(wb, ws, "Jobs");
    }

    // Write to the temporary file
    xlsx.writeFile(wb, tempFilePath, { bookType: "xlsx" });

    // Rename the temporary file to the final file name
    await retryRename(tempFilePath, filePath);
  } catch (error) {
    console.error(chalk.red("Error saving Excel file:"), error);
  }
};

// Helper function for renaming with retry logic
const retryRename = async (oldPath, newPath, retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await fs.promises.rename(oldPath, newPath);
      return;
    } catch (error) {
      if (i < retries - 1) {
        console.log(
          chalk.yellow(`Retrying rename operation (${i + 1}/${retries})...`)
        );
        await sleep(1000); // Wait before retrying
      } else {
        throw error;
      }
    }
  }
};

// Function to scrape jobs for a specific role
const scrapeJobsForRole = async (role, timeout) => {
  const executablePath = await findBrowser();
  let browser;
  let page;

  // Retry logic for launching the browser and performing scraping
  const maxRetries = 3;
  let attempt = 0;
  let success = false;

  while (attempt < maxRetries && !success) {
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          "--disable-notifications",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-gpu",
          "--disable-images",
          "--disable-dev-shm-usage",
          "--no-zygote",
        ],
      });
      page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      const context = browser.defaultBrowserContext();
      await context.overridePermissions("https://www.naukri.com", [
        "geolocation",
      ]);

      let allJobs = [];
      let hasNextPage = true;
      let currentPageNumber = 1;
      const baseUrl = `https://www.naukri.com/${role}-jobs-in-${location}?fjb=${freshness}`;
      const filePath = path.join(saveDirectory, `${role}-jobs.xlsx`);

      const startTime = Date.now();

      while (hasNextPage) {
        if (Date.now() - startTime > timeout) {
          chalkanimation.rainbow("Stopping scraping due to time limit.\n");
          await sleep();
          console.log(
            `Excel file/files saved in ${chalk.bgBlue(` ${saveDirectory}`)}`
          );

          process.exit(1);
        }

        try {
          let userAgent = randomUseragent.getRandom(
            (ua) => ua.deviceType === "desktop"
          );
          if (!userAgent) {
            userAgent =
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
          }
          await page.setUserAgent(userAgent);

          const url =
            currentPageNumber === 1
              ? baseUrl
              : `${baseUrl}&page=${currentPageNumber}`;
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });

          await autoScroll(page);

          await page.waitForSelector(".srp-jobtuple-wrapper", {
            timeout: 20000,
          });

          const jobs = await page.evaluate(() => {
            const jobElements = Array.from(
              document.querySelectorAll(".srp-jobtuple-wrapper")
            );
            return jobElements.map((el) => {
              const title = el.querySelector("a.title")?.innerText || "";
              const company =
                el.querySelector("a.companyName")?.innerText || "";
              const location =
                el.querySelector("a.jobLocation")?.innerText || "";
              const experience =
                el.querySelector(".exp-wrap")?.innerText.trim() ||
                "No experience";
              const link = el.querySelector("a.title")?.href || "";
              return { title, company, experience, location, link };
            });
          });

          if (jobs.length === 0) {
            hasNextPage = false;
          } else {
            allJobs = [...allJobs, ...jobs];
            console.log(
              chalk.green(
                `Scraped ${jobs.length} jobs from page ${currentPageNumber}`
              )
            );
            const nextButtonSelector =
              'div[class="styles_pagination-cont__sWhS6"] > div > a:nth-of-type(2)';
            const nextButton = await page.$(nextButtonSelector);
            if (nextButton) {
              await Promise.all([
                page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                nextButton.click(),
              ]);
              currentPageNumber++;
              await sleep(3000); // Wait before next navigation
            } else {
              hasNextPage = false;
            }
          }
        } catch (error) {
          console.error(chalk.red("Error scraping page:"), error);
          hasNextPage = false;
        }
      }

      await writeJobsToExcel(allJobs, filePath);
      success = true;
      console.log(chalk.bgGreen(`Scraping completed for role: ${role}`));
    } catch (error) {
      console.error(chalk.red("Error in browser launch or scraping:"), error);
      attempt++;
      if (attempt >= maxRetries) {
        console.error(chalk.red("Max retries reached. Exiting."));
      } else {
        console.log(
          chalk.yellow(`Retrying browser launch (${attempt}/${maxRetries})...`)
        );
        await sleep(5000); // Wait before retrying
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
};

// Function to handle auto-scrolling on the page
const autoScroll = async (page) => {
  await page.evaluate(async () => {
    const distance = 100;
    const delay = 100;
    while (
      document.documentElement.scrollTop + window.innerHeight <
      document.documentElement.scrollHeight
    ) {
      document.documentElement.scrollTop += distance;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  });
};

// Main function to start scraping for all roles
const scrapeAllJobs = async () => {
  await welcome();

  const limit = pLimit(roles.length);
  const rolePromises = roles.map((role) =>
    limit(() => scrapeJobsForRole(role, timeLimit))
  );

  await Promise.all(rolePromises);

  console.log(chalk.bgBlue("All scraping tasks completed."));
};

scrapeAllJobs();
