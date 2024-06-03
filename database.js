const mysql = require('mysql');

// Create MySQL connection pool
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'ROOT@123',
  database: 'canteen_management',
});

module.exports = connection;