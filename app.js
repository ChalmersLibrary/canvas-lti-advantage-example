'use strict';

const pkg = require('./package.json');
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const fileStore = require('session-file-store')(session);
const helmet = require('helmet');
const bodyParser = require('body-parser');
const logger = require('pino')();
const dotenv = require('dotenv').config();
const lti = require('ltijs').Provider
const Database = require('ltijs-sequelize')
const routes = require('./src/routes');

const port = process.env.PORT || 3000;
const NODE_MAJOR_VERSION = process.versions.node.split('.')[0];
const NODE_MINOR_VERSION = process.versions.node.split('.')[1];

logger.level = "debug";

const cookieMaxAge = 3600000 * 12; // 12h

const fileStoreOptions = { ttl: 3600 * 12, retries: 3 };

const sessionOptions = { 
    store: new fileStore(fileStoreOptions),
    secret: "keyboard cat dog mouse",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {  }
};

const sessionCookieOptions = {
    maxAge: cookieMaxAge
};

// this express server should be secured/hardened for production use
const app = express();

// secure express server
app.use(helmet({
    frameguard: false
}));

app.disable('X-Powered-By');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

app.set('json spaces', 2);

// need different session cookie options for production
if (process.env.NODE_ENV === "production") {
    app.set('trust proxy', 1);
    sessionOptions.cookie.secure = "true";
    sessionOptions.sameSite = 'none'; 
}

// Development, in Azure it's set via XML config?
app.use("/assets", express.static(__dirname + '/public/assets'));

app.use(cors());
app.use(session(sessionOptions));

console.log(process.env);


// Setup db
const db = new Database('test', 'postgres', 'postgrespw', { 
    host: 'localhost',
    port: 49153,
    dialect: 'postgresql',
    logging: false 
});

// Setup provider
lti.setup('LTIKEY', { // Key used to sign cookies and tokens 
    plugin: db // Passing db object to plugin field
  },
  { // Options
    appRoute: '/', loginRoute: '/login', dynRegRoute: '/register', // Optionally, specify some of the reserved routes
    cookies: {
      secure: false, // Set secure to true if the testing platform is in a different domain and https is being used
      sameSite: '' // Set sameSite to 'None' if the testing platform is in a different domain and https is being used
    },
    devMode: true // Set DevMode to false if running in a production environment with https
  }
);

// Set lti launch callback
lti.onConnect(async (token, req, res) => {
    console.log(token);

    return res.send("<a href='/members'>Members</a> | <a href='/info'>Info</a>");
});

// Setting up routes
lti.app.use(routes)

const setup = async () => {
    // Deploy server and open connection to the database
    await lti.deploy({ port: port }); // Specifying port. Defaults to 3000

    // Register platform
    await lti.registerPlatform({
        url: 'https://canvas.instructure.com',
        name: 'Canvas',
        clientId: process.env.CANVAS_CLIENT_ID,
        authenticationEndpoint: process.env.PLATFORM_AUTH_URL,
        accesstokenEndpoint: process.env.PLATFORM_TOKEN_URL,
        authConfig: { method: 'JWK_SET', key: process.env.PLATFORM_KEYSET_URL }
    });
};

// Start LTI provider in serverless mode
// lti.deploy({ port: port });

setup();

/*
process.on('uncaughtException', (err) => {
    logger.error('There was an uncaught error: ' + err, err);
    process.exit(1); //mandatory (as per the Node docs)
});
*/




