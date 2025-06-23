const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello!');
});

app.listen(5050, () => {
  console.log('Test server running!');
});
