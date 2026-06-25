#!/usr/bin/env node
require('dotenv').config();
const { publishScheduledContent } = require('../utils/scheduledPublisher');

publishScheduledContent()
  .then((result) => {
    console.log(`Published ${result.posts} post(s) and ${result.pages} page(s).`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
