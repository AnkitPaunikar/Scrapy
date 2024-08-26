##This is Scrapy a CLI tool.
###The basic function of this tool is to do scraping of Jobs with roles and other filter information


Parameters of filtering:
–location (required): Specify the location where you want to find jobs.
–experience (required): Define the number of years of experience required for the job.
–roles (required): List the job titles you want to search for, separated by spaces.
–freshness (optional): Filter jobs by freshness in days. Default is 7 days.
–timeout (optional): Set a time limit for the script to run in minutes. Default is 320 minutes.

You can run this locally by:

```ruby
npm i -g scrapy-cli 
```
Then
example:

```ruby
npx scrapy-cli --location pune --experience 3 --roles react-developer  --freshness 7 --timeout 1
```



