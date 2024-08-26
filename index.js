#!/usr/bin/env node

import puppeteer from "puppeteer-core";
import randomUseragent from "random-useragent";
import pLimit from "p-limit";
import ExcelJS from "exceljs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import os from "os";
import fs from "fs";
import gradient from "gradient-string";
import chalk from "chalk";
import chalkanimation from "chalk-animation";
import figlet from "figlet";

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
const freshness = argv.freshness;
const timeLimit = argv.timeout * 60 * 1000;
const saveDirectory = argv.directory;

if (!fs.existsSync(saveDirectory)) {
  fs.mkdirSync(saveDirectory, { recursive: true });
}

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

async function welcome() {
  const msg = "Scrapy is working...";
  const scrapy = `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⡀⠀⠀⠀⢀⡄⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡞⠀⠀⠀⠀⢀⡤⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠳⣆⡀⠀⠀⠸⡄⠀⢀⣾⡇⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢠⡀⠀⠀⠀⠀⠀⣼⠁⠀⠀⣠⣾⡟⠁⠀⢀⣀⣤⣤⣤⣤⣶⣶⣶⣶⣦⣤⣤⣀⡀⠀⠙⣿⣦⡀⠀⣷⢠⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠻⣶⣄⠀⠀⢠⣿⠀⢠⣾⣿⣟⣤⣶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⣼⣿⣿⣶⣿⣿⣿⣿⡇⠀⠀⠀⣀⣤⠆⠀⠀
⠀⠀⠀⠀⠀⠀⠻⣿⣦⣄⢸⣿⣠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇⣠⣤⣶⠟⠉⠀⠀⠀
⠀⠀⠀⠀⠀⠀⣀⣘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀⠀⠀⠀
⠠⠤⠶⠶⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣶⠶⠶⠒⠂
⠀⠀⠀⠀⠀⣀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⣄⠀⠀⠀⠀
⠀⠀⢀⣴⣾⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠋⠈⠀⠀⠀⠙⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠿⣿⣶⣄⠀
⣠⠾⠛⠉⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄⡀⠀⠀
⠀⠀⠀⠀⢠⣿⠏⢸⣿⣿⣿⣿⣿⣿⣿⣿⠟⢻⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠙⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣏⠉⠙⠛⠓⠆
⠀⠀⠀⢀⡿⠁⠀⡼⢻⣿⣿⣿⣿⣿⠟⠁⠀⠘⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠏⠀⠀⠀⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇⠹⣿⡄⠀⠀⠀⠀
⠀⠀⠀⠈⠁⠀⠐⠁⠀⣿⣿⣿⠟⣿⠀⠀⠀⠀⠙⠳⣀⠀⠀⡀⢀⠀⠀⠀⢠⠋⠀⠀⠀⠀⠀⣸⠁⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⡷⠮⢷⡀⠀⠀⠀
⠀⠀⠀⠀⢠⡠⠤⠖⢻⣿⣿⡇⠠⣿⣀⣀⣀⣀⣀⣀⣀⣀⠀⠸⠸⠄⠀⠀⣠⣀⣀⣠⣀⡀⠰⠧⠤⠤⠬⣿⣿⣿⣿⣿⣿⣿⣷⣷⠦⠴⠒⠊⠀⠀
⠀⠀⠀⠀⠈⠁⠀⠀⢸⡏⢻⡇⠀⠉⠉⠙⠿⠋⠉⠉⠛⠋⠀⠀⠀⠀⠀⠀⠉⠉⠙⠿⠋⠁⠀⠀⠀⠀⠀⢹⣿⣿⣻⣿⠿⣿⡿⢯⣦⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⣼⠀⢰⣧⣀⠀⠀⠀⠀⢀⣀⡆⠀⠀⠀⠀⠀⠀⢠⣄⣀⠀⠀⠀⠀⢀⣠⡴⡅⢸⠇⠏⠁⠀⠀⠀⠹⡎⢿⠄⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠃⣷⠀⠀⠉⠚⠿⠛⠿⠿⠛⠉⣠⡴⣶⣦⣤⣄⠀⠀⠛⠟⠛⣭⣉⠛⠿⠛⠊⠀⠁⠀⠀⠀⠀⠀⠀⢀⡇⢩⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠈⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡠⠊⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⣦⡀⠀⠀⠀⠐⠒⠂⠠⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⢟⣛⠋⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⣤⣬⣿⣷⣤⣄⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣤⣤⣤⣤⣦⣶⣶⡚⣩⣴⢿⢿⢳⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣻⣵⣫⣿⣿⣿⣧⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⡻⠻⠛⣫⡻⣿⣿⣿⣿⣿⡿⣿⢿⣿⣿⣿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⢣⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠛⠷⣮⣮⣾⣷⣿⣿⣿⣿⣿⣿⣿⣧⣿⣷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠊⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠐⠋⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠿⠿⠿⠿⠿⠿⠛⠛⠛⠋⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠉⠉⠉⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
  `;
  figlet(msg, (err, data) => {
    if (err) console.error(err);
    console.log(gradient.pastel.multiline(data));
    console.log(gradient.pastel.multiline(scrapy));
  });
  await sleep();
}

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

const writeJobsToExcel = async (jobs, filePath) => {
  const tempFilePath = `${filePath}.tmp`;
  const workbook = new ExcelJS.Workbook();
  let worksheet;

  try {
    if (fs.existsSync(filePath)) {
      await workbook.xlsx.readFile(filePath);
      worksheet = workbook.getWorksheet("Jobs");

      if (worksheet) {
        // Append new jobs to the existing worksheet
        jobs.forEach((job) => {
          const rowValues = Object.values(job);
          worksheet.addRow(rowValues);
        });
      } else {
        worksheet = workbook.addWorksheet("Jobs");
        worksheet.addRows(jobs);
      }
    } else {
      worksheet = workbook.addWorksheet("Jobs");
      worksheet.addRows(jobs);
    }

    await workbook.xlsx.writeFile(tempFilePath);

    await retryRename(tempFilePath, filePath);
  } catch (error) {
    console.error(chalk.red("Error saving Excel file:"), error);
  }
};

const retryRename = async (tempFilePath, filePath) => {
  try {
    fs.renameSync(tempFilePath, filePath);
  } catch (error) {
    console.error(chalk.red("Error renaming file:"), error);
    setTimeout(() => retryRename(tempFilePath, filePath), 1000);
  }
};

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

const scrapeAllJobs = async () => {
  await welcome();

  const limit = pLimit(roles.length);
  const rolePromises = roles.map((role) =>
    limit(() => scrapeJobsForRole(role, timeLimit))
  );

  await Promise.all(rolePromises);
};

const scrapeJobsForRole = async (role, timeout) => {
  const executablePath = await findBrowser();
  let browser;
  let page;

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
          chalkanimation.rainbow("Scrapy stopping due to time limit.\n");
          await sleep();
          console.log(
            `Scrapy saved excel file in: ${chalk.bgBlue(` ${saveDirectory}`)}`
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

          const experienceArg = parseInt(argv.experience, 10) || 3;

          const locationArg = argv.location.toLowerCase().trim();

          const jobs = await page.evaluate(() => {
            const jobElements = Array.from(
              document.querySelectorAll(".srp-jobtuple-wrapper")
            );
            return jobElements.map((el) => {
              const title = el.querySelector("a.title")?.innerText || "";
              const company = el.querySelector("a.comp-name")?.innerText || "";
              const location = el.querySelector(".loc-wrap")?.innerText || "";
              const experienceElement = el.querySelector(".exp-wrap");
              const experience = experienceElement
                ? experienceElement.innerText.trim()
                : "No experience";
              const link = el.querySelector("a.title")?.href || "";
              return { title, company, experience, location, link };
            });
          });

          const filteredJobs = jobs.filter((job) => {
            const experience = job.experience
              ? job.experience.trim().toLowerCase()
              : "no experience";
            let minExperience = 0;
            let maxExperience = Infinity; // Default to Infinity if max value is not provided

            if (experience.includes("-")) {
              const parts = experience.split("-");
              minExperience = parseInt(parts[0], 10);
              maxExperience = parseInt(parts[1], 10);
            } else if (experience.includes("year")) {
              minExperience = maxExperience = parseInt(experience, 10);
            }

            const includesDesiredExperience =
              minExperience <= experienceArg && experienceArg <= maxExperience;

            // Location filtering
            const jobLocation = job.location.toLowerCase();

            return (
              includesDesiredExperience && jobLocation.includes(locationArg) // Ensure case-insensitive comparison
            );
          });

          allJobs = [...allJobs, ...filteredJobs];
          await writeJobsToExcel(allJobs, filePath);
          console.log(
            chalk.green(
              `Scrapy found ${filteredJobs.length}! jobs from page ${currentPageNumber}`
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
            await sleep(3000);
          } else {
            hasNextPage = false;
          }
        } catch (error) {
          console.error(chalk.red("Error Scrapy page:"), error);
          hasNextPage = false;
        }
      }

      success = true;
      console.log(chalk.bgGreen(`Scrapy completed the role: ${role}`));
    } catch (error) {
      console.error(
        chalk.red("Not Scrapy's mistake browser did not launch:"),
        error
      );
      attempt++;
      if (attempt >= maxRetries) {
        console.error(chalk.red("Scrapy tried"));
      } else {
        console.log(
          chalk.yellow(
            `Scrapy is trying to launch browser (${attempt}/${maxRetries})...`
          )
        );
        await sleep(5000);
      }
    }
  }
};

await scrapeAllJobs();
