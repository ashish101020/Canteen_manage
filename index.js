const express = require("express");
const connection = require('./database.js');
const session = require('express-session');

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.set("view engine", "ejs");
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));

connection.connect((error) => {
    if (error) {
        console.log('Database connection failed: ' + error.stack);
    }
    console.log('Connected to database as id ' + connection.threadId);
});


// Authentication route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const query = "SELECT * FROM users WHERE email = ? AND password = ?";
    connection.query(query, [email, password], (error, results) => {
        if (error) {
            console.error('Error executing query:', error);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 1) {
            req.session.user = results[0];
            res.redirect('/home');
        } else {
            res.send('Invalid username or password');
        }
    });
});

// Home page route
app.get('/home', (req, res) => {
    if (req.session.user) {
        res.sendFile(__dirname + '/home.html');
    } else {
        res.redirect('/login');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/login');
    });
});

// Login page route
app.get('/login', (req, res) => {
    if (req.session.user) {
        res.redirect('/home');
    } else {
        res.sendFile(__dirname + "/loginpage.html");
    }
});

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/signup', (req, res) => {
    res.sendFile(__dirname + "/signupPage.html");
});

app.post('/signup', (req, res) => {
    const email = req.body.email;
    const psw = req.body.password;

    // Prepare SQL query with placeholders
    const sql = "INSERT INTO users (email, password) VALUES (?, ?)";

    // Execute the query with user inputs as parameters
    connection.query(sql, [email, psw], (error, results) => {
        if (error) {
            console.error('Error inserting user:', error);
            return res.status(500).send('Error registering user');
        }

        // Successfully inserted user, send response
        res.status(200).send('User registered successfully');
    });
});

app.get('/statistics', async (req, res) => {
    try {
        async function query(sql) {
          return new Promise((resolve, reject) => {
            connection.query(sql, (err, results) => {
              if (err) {
                reject(err);
              } else {
                resolve(results);
              }
            });
          });
        }
    
        const sql = `
          SELECT p.product_id, p.name, p.description, SUM(co.quantity) AS total_sold
          FROM Menu AS p
          LEFT JOIN Customer_Orders AS co ON p.product_id = co.product_id
          GROUP BY p.product_id
          ORDER BY total_sold DESC
        `;
        const results = await query(sql);
        res.render(__dirname + '/statistics', { products: results });
      } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Internal Server Error');
      }
});

app.get('/employees-management', async (req, res) => {
    try {
        const sql = "SELECT * FROM employee";
        const result = await new Promise((resolve, reject) => {
            connection.query(sql, (error, result) => {
                if (error) {
                    console.error('Error fetching:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
        res.render(__dirname + "/empManage", { employees: result });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching');
    }
});
app.get('/add-employee', (req, res)=>{
    res.sendFile(__dirname+"/addEmployee.html");
});
app.post('/add-employee', (req, res) => {
    const { name, age, joiningDate, resignDate, salary, address, aadhar, phone } = req.body;
    const sql = 'INSERT INTO Employee (name, age, joiningDate, resignDate, salary, Address, aadhar, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [name, age, joiningDate, resignDate, salary, address, aadhar, phone];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error creating employee');
            return;
        }
        console.log('Employee created successfully');
        res.redirect('/add-employee');
    });
});

app.get('/add-salary/:employeeId', (req, res) => {
    const empId = parseInt(req.params.employeeId);

    const query = 'SELECT * FROM employee WHERE employeeId = ?';
    connection.query(query, [empId], (error, results) => {
        if (error) {
            console.error('Error fetching salary:', error);
            return res.status(500).send('Error fetching salary');
        }
        if (results.length === 0) {
            return res.status(404).send('salary not found');
        }
        const employee = results[0];
        res.render(__dirname+'/addSalary', { employee });
    });
});


// Route to handle the form submission for adding products for a particular vendor
app.post('/add-salary/:employeeId', (req, res) => {
    const empId = parseInt(req.params.employeeId);
    const { month, amount} = req.body;

    const sql = 'INSERT INTO Salary (salaryMonth, employeeId, paidAmount) VALUES (?, ?, ?)';
    
    connection.query(sql, [month, empId, amount], (err, result) => {
        if (err) {
            console.error('Error inserting salary product into the database: ' + err);
            res.status(500).send('Internal Server Error');
            return;
        }
        console.log('New salary added with ID: ' + result.insertId);
        res.redirect('/add-salary');
    });
});

app.get('/emp-salary-data/:employeeId', async (req, res) => {
    try {
        const empId = req.params.employeeId; // Extract vendor_id from URL parameter
        const sql = `SELECT s.salaryMonth, s.paidAmount, s.paymentDate
        FROM salary s 
        INNER JOIN employee e ON s.employeeId = e.employeeId
        WHERE s.employeeId = ?`; // Add WHERE clause to filter by vendor_id
        const result = await new Promise((resolve, reject) => {
            connection.query(sql, [empId], (error, result) => {
                if (error) {
                    console.error('Error fetching:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
        res.render(__dirname + "/salaryDetail", { salary: result });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching products');
    }
});
app.get('/vendors-management', async (req, res) => {
    try {
        const sql = "SELECT * FROM vendors";
        const result = await new Promise((resolve, reject) => {
            connection.query(sql, (error, result) => {
                if (error) {
                    console.error('Error fetching:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
        res.render(__dirname + "/vendorManage", { vendors: result });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching vendors');
    }
});
app.get('/add-vendor', (req, res) => {
    res.sendFile(__dirname + "/addVendor.html");
});
app.post('/add-vendor', (req, res) => {
    const { name, phone, type } = req.body;

    // Insert vendor data into the database
    const sql = 'INSERT INTO vendors (vendor_name, vendor_type, phone) VALUES (?, ?, ?)';
    connection.query(sql, [name, type, phone], (err, result) => {
        if (err) {
            console.error('Error inserting vendor into the database: ' + err);
            res.status(500).send('Internal Server Error');
            return;
        }
        console.log('New vendor added with ID: ' + result.insertId);
        res.redirect('/add-vendor');
    });
});
// Route to render the page for adding products for a particular vendor
app.get('/addProduct/:vendor_id', (req, res) => {
    const vendorId = parseInt(req.params.vendor_id);
    // Query MySQL to fetch the vendor with the specified ID
    const query = 'SELECT * FROM vendors WHERE vendor_id = ?';
    connection.query(query, [vendorId], (error, results) => {
        if (error) {
            console.error('Error fetching vendor:', error);
            return res.status(500).send('Error fetching vendor');
        }
        if (results.length === 0) {
            return res.status(404).send('Vendor not found');
        }
        const vendor = results[0];
        res.render(__dirname+'/VenPurchase', { vendor });
    });
});


// Route to handle the form submission for adding products for a particular vendor
app.post('/addProduct/:vendor_id', (req, res) => {
    const vendorId = parseInt(req.params.vendor_id);
    const { productName, productPrice} = req.body;

    const sql = 'INSERT INTO vend_purchase (product_name, vendor_id, price) VALUES (?, ?, ?)';
    
    connection.query(sql, [productName, vendorId, productPrice], (err, result) => {
        if (err) {
            console.error('Error inserting vendor product into the database: ' + err);
            res.status(500).send('Internal Server Error');
            return;
        }
        console.log('New product added with ID: ' + result.insertId);
        res.redirect('/addProduct');
    });
});

app.get('/purchased-Product/:vendor_id', async (req, res) => {
    try {
        const vendor_id = req.params.vendor_id; // Extract vendor_id from URL parameter
        const sql = `SELECT vp.product_name, vp.order_date, vp.price
        FROM vend_purchase vp 
        INNER JOIN vendors v ON vp.vendor_id = v.vendor_id
        WHERE vp.vendor_id = ?`; // Add WHERE clause to filter by vendor_id
        const result = await new Promise((resolve, reject) => {
            connection.query(sql, [vendor_id], (error, result) => {
                if (error) {
                    console.error('Error fetching:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
        res.render(__dirname + "/vendorOrderDetail", { orders: result });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching products');
    }
});

app.get('/customers-management', async (req, res) => {
    try {
        const sql = "SELECT * FROM customers";
        const result = await new Promise((resolve, reject) => {
            connection.query(sql, (error, result) => {
                if (error) {
                    console.error('Error fetching:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
            
        });
        res.render(__dirname + "/custManage", { customers: result });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching customers');
    }
});

// GET route to serve the HTML form
app.get('/addCustomer', (req, res) => {
    res.sendFile(__dirname + "/addCustomerPage.html");
});

app.post('/addCustomer', (req, res) => {
    const { name, email, phone, type, expiryDate, balance } = req.body;

    let sql;
    let values;

    if (type === 'subscription') {
        sql = 'INSERT INTO Customers (name, email, phone, type, subscription_expiry_date) VALUES (?, ?, ?, ?, ?)';
        values = [name, email, phone, type, expiryDate];

        connection.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error inserting customer into the database: ' + err);
                res.status(500).send('Internal Server Error');
                return;
            }
            console.log('New subscription customer added with ID: ' + result.insertId);
            res.redirect('/addCustomer');
        });

    } else if (type === 'prepaid') {
        sql = 'INSERT INTO Customers (name, email, phone, type) VALUES (?, ?, ?, ?)';
        values = [name, email, phone, type];

        connection.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error inserting customer into the database: ' + err);
                res.status(500).send('Internal Server Error');
                return;
            }

            const customerId = result.insertId;
            const addAmount = balance;
            const sql2 = 'INSERT INTO Customer_Orders (customer_id, addAmount, remaining_balance) VALUES (?, ?, ?)';
            const values2 = [customerId, addAmount, balance];

            connection.query(sql2, values2, (err, result) => {
                if (err) {
                    console.error('Error inserting initial balance for prepaid customer: ' + err);
                    res.status(500).send('Internal Server Error');
                    return;
                }

                console.log('New prepaid customer added with ID: ' + customerId);
                res.redirect('/addCustomer');
            });
        });

    } else {
        console.error('Invalid customer type');
        res.status(400).send('Bad Request');
    }
});

app.post('/addAmount/', (req, res) => {
    const { customerId, amount } = req.body;

    const sql = 'INSERT INTO Customer_Orders (customer_id, addAmount, remaining_balance) VALUES (?, ?, ?)';
    const getBalanceSql = 'SELECT remaining_balance FROM Customer_Orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 1';

    connection.query(getBalanceSql, [customerId], (err, results) => {
        if (err) {
            console.error('Error fetching current balance: ' + err);
            res.status(500).send('Internal Server Error');
            return;
        }

        const currentBalance = results.length ? results[0].remaining_balance : 0;
        const newBalance = currentBalance + parseFloat(amount);

        connection.query(sql, [customerId, amount, newBalance], (err, result) => {
            if (err) {
                console.error('Error adding amount to customer balance: ' + err);
                res.status(500).send('Internal Server Error');
                return;
            }

            console.log('Added amount to customer ID: ' + customerId);
            res.redirect('/addAmount/' + customerId); // Adjust this to redirect where you want
        });
    });
});

app.get('/takeOrder/:customer_id', (req, res) => { 
    const custId = parseInt(req.params.customer_id);
    
    const query1 = 'SELECT * FROM Customers WHERE customer_id = ?'; // Updated table name
    connection.query(query1, [custId], (error, results) => {
        if (error) {
            console.error('Error fetching customer:', error);
            return res.status(500).send('Error fetching customer');
        }
        if (results.length === 0) {
            return res.status(404).send('Customer not found');
        }
        const customer = results[0];

        const query2 = 'SELECT * FROM Menu';
        connection.query(query2, (err, menu) => {
            if (err) {
                console.error('Error fetching menu data:', err);
                res.status(500).send('Error fetching menu data');
                return;
            }
            // Once both queries are executed, render the EJS file and pass the results
            res.render(__dirname+'/takeOrder', { customer: customer, menu: menu });
        }); 
    });
});

app.post('/takeOrder/:customerId', (req, res) => {
    const customerId = parseInt(req.params.customerId);
    const productId = parseInt(req.body.foodId);
    const quantity = parseInt(req.body.quantity);

    if (!customerId || !productId || !quantity) {
        return res.status(400).send('Customer ID, Product ID, and Quantity are required');
    }

    const queryPrice = 'SELECT price FROM Menu WHERE product_id = ?';
    connection.query(queryPrice, [productId], (err, resultPrice) => {
        if (err) {
            console.error('Error fetching product price:', err);
            res.status(500).send('Error fetching product price');
            return;
        }

        if (resultPrice.length === 0) {
            return res.status(404).send('Product not found');
        }

        const price = resultPrice[0].price;
        const totalAmount = price * quantity;

        const queryGetBalance = 'SELECT remaining_balance FROM Customer_Orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 1';
        connection.query(queryGetBalance, [customerId], (err, resultBalance) => {
            if (err) {
                console.error('Error fetching customer balance:', err);
                res.status(500).send('Error fetching customer balance');
                return;
            }

            if (resultBalance.length === 0) {
                return res.status(404).send('Customer balance not found');
            }

            const currentBalance = resultBalance[0].remaining_balance;

            if (currentBalance < totalAmount) {
                return res.status(400).send('Insufficient balance');
            }

            const newBalance = currentBalance - totalAmount;

            const queryInsertOrder = 'INSERT INTO Customer_Orders (customer_id, product_id, quantity, total_amount, remaining_balance) VALUES (?, ?, ?, ?, ?)';
            connection.query(queryInsertOrder, [customerId, productId, quantity, totalAmount, newBalance], (err, resultOrder) => {
                if (err) {
                    console.error('Error saving order:', err);
                    res.status(500).send('Error saving order');
                    return;
                }

                console.log('Order placed successfully');
                res.redirect('/takeOrder/' + customerId);
            });
        });
    });
});

app.get('/take-order-instant', (req, res) => {
    const query2 = 'SELECT * FROM Menu';
    connection.query(query2, (err, menu) => {
        if (err) {
            console.error('Error fetching menu data:', err);
            res.status(500).send('Error fetching menu data');
            return;
        }
            // Once both queries are executed, render the EJS file and pass the results
        res.render(__dirname+'/takeNonOrder', {  menu: menu });
    });
});
app.post('/take-order-instant', (req, res) => {
    const productId = req.body.foodId; // Use the name attribute of the select element
    const quantity = req.body.quantity;
    
    // Validate if productId, and quantity are provided
    if (!productId || !quantity) {
        return res.status(400).send('Product ID, and Quantity are required');
    }
    
    // Insert the order into the database
    const query = 'INSERT INTO Customer_Orders (product_id, quantity) VALUES (?, ?)';
    connection.query(query, [productId, quantity], (err, result) => {
        if (err) {
            console.error('Error saving order:', err);
            res.status(500).send('Error saving order');
            return;
        }
        console.log('Order placed successfully');
        // Redirect to a success page or back to the customer_order page
        res.redirect('/take-order-instant');
    });
});
app.get('/view-all-Order/:customer_id', async (req, res) => {
    try {
        const custId = req.params.customer_id;

        const orderQuery = `
        SELECT 
            Menu.name,
            Menu.price,
            Customer_Orders.quantity,
            Customer_Orders.total_amount,
            Customer_Orders.order_date,
            Customer_Orders.addAmount,
            Customer_Orders.remaining_balance
        FROM 
            Customer_Orders
        JOIN 
            Menu ON Customer_Orders.product_id = Menu.product_id    
        WHERE 
            Customer_Orders.customer_id = ?`;

        const customerTypeQuery = `
        SELECT 
            type
        FROM 
            Customers
        WHERE 
            customer_id = ?`;

        const [orderResult, customerTypeResult] = await Promise.all([
            new Promise((resolve, reject) => {
                connection.query(orderQuery, [custId], (error, result) => {
                    if (error) {
                        console.error('Error fetching orders:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            }),
            new Promise((resolve, reject) => {
                connection.query(customerTypeQuery, [custId], (error, result) => {
                    if (error) {
                        console.error('Error fetching customer type:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            })
        ]);

        res.render(__dirname + "/custOrderDetail", {
            Orders: orderResult,
            CustomerType: customerTypeResult[0]?.type, // Assuming customerTypeResult is an array with a single object
            custId
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching data');
    }
});

app.get('/take-attendance/:CustId', (req, res)=>{
    
})

// GET route to render the add_food.ejs file
app.get('/add-food', (req, res) => {
    res.sendFile(__dirname + "/addFood.html");
});

// POST route to handle form submission and add food to the menu
app.post('/add-food', (req, res) => {
    const name = req.body.name;
    const description = req.body.description;
    const price = req.body.price;

    // Validate if name, description, and price are provided
    if (!name || !description || !price) {
        return res.status(400).send('Name, description, and price are required');
    }

    // Insert the food item into the Menu table
    const query = 'INSERT INTO Menu (name, description, price) VALUES (?, ?, ?)';
    connection.query(query, [name, description, price], (err, result) => {
        if (err) {
            console.error('Error adding food to menu:', err);
            res.status(500).send('Error adding food to menu');
            return;
        }
        console.log('Food added to menu successfully');
        // Redirect to a success page or back to the add-food page
        res.redirect('/add-food');
    });
});




const port = 3000;
app.listen(port, () => {
    console.log(`port listen at ${port}`)
});
