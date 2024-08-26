## Scrapy CLI Tool

### Overview

Scrapy is a CLI tool designed for scraping job listings based on various filter parameters.

### Parameters of Filtering

- **–location (required)**: Specify the location where you want to find jobs.
- **–experience (required)**: Define the number of years of experience required for the job.
- **–roles (required)**: List the job titles you want to search for, separated by spaces.
- **–freshness (optional)**: Filter jobs by freshness in days. Default is 7 days.
- **–timeout (optional)**: Set a time limit for the script to run in minutes. Default is 320 minutes.

### Installation

You can install Scrapy CLI globally using npm:

```sh
npm i -g scrapy-cli
```

example:

```ruby
npx scrapy-cli --location pune --experience 3 --roles react-developer  --freshness 7 --timeout 1
```
