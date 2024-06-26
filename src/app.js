const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const localStrategy = require("passport-local").Strategy;
require("dotenv").config();
const crypto = require("crypto");
const Pool = require("pg").Pool;

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;
const connectionString = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}/${PGDATABASE}?sslmode=require&project=${ENDPOINT_ID}`;

const pool = new Pool({
   connectionString: connectionString,
});

async function getPgVersion() {
   pool.query("select version()", (err, res) => {
      if (!err) {
         console.log("PostgreSQL version: ", res.rows[0].version);
      } else {
         console.log("Error: ", err);
      }
      pool.end();
   });
}
getPgVersion();

passport.use(
   "local-login",
   new localStrategy(
      {
         usernameField: "email",
         passwordField: "password",
         passReqToCallback: true,
      },
      async (req, email, password, done) => {
         try {
            // const user = users.find((user) => user.email === email);
            const connection = await oracledb.getConnection(dbConfig);
            const result = await connection.execute(
               `SELECT * FROM attendee_organizer_combined WHERE EMAIL = :email`,
               [email]
            );
            await connection.close();

            if (result.rows.length === 0) {
               return done(null, false, { message: "No user with that email" });
            }

            const user = result.rows[0];
            // password on 4th index; if not work -> prob. view changed
            const isPasswordMatch = await bcrypt.compare(password, user[3]);
            // const isPasswordMatch = password === user[3];
            if (!isPasswordMatch) {
               return done(null, false, { message: "Password incorrect" });
            }

            return done(null, user);
         } catch (error) {
            return done(error);
         }
      }
   )
);
passport.serializeUser((user, done) => {
   // done(null, user.email);
   done(null, user[2]);
});
passport.deserializeUser(async (email, done) => {
   // const user = users.find((user) => user.email === email);
   try {
      const connection = await oracledb.getConnection(dbConfig);
      const result = await connection.execute(
         `SELECT * FROM attendee_organizer_combined WHERE EMAIL = :email`,
         [email]
      );
      await connection.close();

      if (result.rows.length === 0) {
         return done(new Error("User not found"));
      }
      const user = result.rows[0];
      // return done(null, user);
      return done(null, user);
   } catch (error) {
      return done(error);
   }
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
   session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
   })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

app.use(express.static("public"));
app.set("views", "./views");
app.set("view engine", "ejs");

app.delete("/logout", (req, res, next) => {
   req.logOut((err) => {
      if (err) {
         return next(err);
      }
      res.redirect("/");
   });
});
checkAuthenticated = (req, res, next) => {
   if (req.isAuthenticated()) {
      return next();
   }

   res.redirect("/");
};
checkNotAuthenticated = (req, res, next) => {
   if (req.isAuthenticated()) {
      return res.redirect("/home");
   }
   next();
};
checkForOrganizer = (req, res, next) => {
   if (req.user[6] === "ORGANIZER") {
      return next();
   }
   res.redirect("/home");
};
checkForAttendee = (req, res, next) => {
   if (req.user[6] === "ATTENDEE") {
      return next();
   }
   res.redirect("/home");
};

app.get("/", checkNotAuthenticated, (req, res) => {
   res.render("root", {});
});
app.get("/home", checkAuthenticated, (req, res) => {
   res.render("home", { user: req.user[6] });
});
app.get("/user", checkNotAuthenticated, (req, res) => {
   res.render("user", {});
});
app.get("/dashboard", checkAuthenticated, (req, res) => {
   res.render("dashboard", {
      user: req.user[6],
      name: req.user[1],
      email: req.user[2],
      phone: req.user[4],
      loc: req.user[5],
   });
});
app.get("/find", checkAuthenticated, checkForAttendee, (req, res) => {
   res.render("find", { user: req.user[6] });
});
// app.get("/create", checkAuthenticated, checkForOrganizer, (req, res) => {
//    res.render("create", { user: req.user[6] });
// });
app.get("/create", (req, res) => {
   res.render("create", { user: "ORGANIZER" });
});
// app.get("/manage", checkAuthenticated, (req, res) => {
//    res.render("manage", { user: req.user[6] });
// });
app.get("/manage", (req, res) => {
   res.render("manage", { user: "ATTENDEE" });
});
app.get("/history", checkAuthenticated, (req, res) => {
   res.render("history", { user: req.user[6] });
});
app.get("/view", (req, res) => {
   res.render("view", { user: "ORGANIZER" });
});

generateUniqueKey = (email, length) => {
   const hash = crypto.createHash("sha256");
   hash.update(email);
   const hashedEmail = hash.digest("hex");
   const decimalString = BigInt(`0x${hashedEmail}`).toString();
   const key = decimalString.slice(0, length).padStart(length, "0");
   return key;
};

sqlCheckForExistUser = async (email) => {
   try {
      const connection = await oracledb.getConnection(dbConfig);
      const result = await connection.execute(
         `SELECT * FROM attendee_organizer_combined WHERE EMAIL = :email`,
         [email]
      );

      await connection.close();
      if (result.rows.length === 0) {
         return "notExist";
      } else {
         return;
      }
   } catch (error) {
      console.error(error);
      throw error;
   }
};
sqlInsertIntoTable = async (data) => {
   try {
      const table =
         data.type === "organizer"
            ? "ORGANIZERS"
            : data.type === "attendee"
            ? "ATTENDEES"
            : "";
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const key = await generateUniqueKey(data.email, 10);
      const connection = await oracledb.getConnection(dbConfig);

      await connection.execute(
         `INSERT INTO ${table} (ID, NAME, EMAIL, PHONE, PASSWORD) VALUES (:id, :name, :email, :phone, :password)`,
         {
            id: key,
            name: data.name,
            email: data.email,
            phone: data.phone,
            password: hashedPassword,
         }
      );
      await connection.commit();
      await connection.close();
   } catch (error) {
      console.error(error);
      throw error;
   }
};
app.post("/user/signup", async (req, res) => {
   try {
      // const userCheck = users.find((user) => user.email === req.body.email);
      console.log(req.body);
      const userCheck = await sqlCheckForExistUser(req.body.email);
      if (!userCheck) {
         console.log("user exists");
         return res.status(400).redirect("/user");
      }
      if (req.body.password !== req.body.confirmPassword) {
         console.log("user pass wrong");
         return res.status(403).redirect("/user");
      }
      await sqlInsertIntoTable(req.body);
      console.log("user created");
      return res.status(200).redirect("/home");
   } catch {
      console.log("error occured");
      return res.status(500).redirect("/user");
   }
   // console.log(users);
});
app.post(
   "/user/login",
   passport.authenticate("local-login", {
      successRedirect: "/home",
      failureRedirect: "/",
      failureFlash: true,
   })
);

/*
app.post(
   "/user/login",
   passport.authenticate("local", {
      successRedirect: "/home",
      failureRedirect: "/",
      failureFlash: true,
   })
);

app.get("/login", (req, res) => {
   res.sendFile(path.join(__dirname, "..", "frontend", "html", "login.html"));
});

app.post(
   "/login",
   passport.authenticate("local", {
      successRedirect: "/",
      failureRedirect: "/register",
      failureFlash: true,
   })
);

app.get("/register", (req, res) => {
   res.render("register");
});

app.post("/user/login", async (req, res) => {
   try {
      const { email, password } = req.body;
      const mail = users.find((user) => user.email === req.body.email);
      // const mail = use_SQL_to_get_email(email);
      if (mail == null) {
         res.redirect("/user", { message: "Email not found" });
      }
      if (await bcrypt.compare(password, mail.password)) {
         // if (await bcrypt.compare(use_SQL_to_get_pass(email), password)) {
         res.redirect("/");
      } else {
         res.redirect("/user", { message: "Invalid email or password" });
      }
   } catch (error) {
      console.error("Login error:", error);
      res.redirect("/user", { message: "Some error occured" });
   }
});
*/

testOracleDBConnection = async () => {
   try {
      const connection = await oracledb.getConnection(dbConfig);
      console.log("Connected to Oracle Database");
      await connection.close();
   } catch (error) {
      console.error("Error connecting to Oracle Database:", error);
   }
};
// testOracleDBConnection();

getDate = (timeStamp) => {
   const dateObj = new Date(timeStamp);
   const year = dateObj.getFullYear();
   const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
   const day = dateObj.getDate().toString().padStart(2, "0");
   return (formattedDate = `${day}/${month}/${year}`);
};

getTime = (timeStamp) => {
   const dateObj = new Date(timeStamp);
   const hours = dateObj.getHours().toString().padStart(2, "0");
   const minutes = dateObj.getMinutes().toString().padStart(2, "0");
   const seconds = dateObj.getSeconds().toString().padStart(2, "0");
   return (formattedTime = `${hours}:${minutes}:${seconds}`);
};

app.get(
   "/manage/:id",
   // checkAuthenticated,
   (req, res) => {
      res.render("event", {
         // user: req.user[6],
         // name: eventData[req.params.id][2],
         // type: eventData[req.params.id][4], // get using SQL
         // date: getDate(eventData[req.params.id][7]),
         // time: getTime(eventData[req.params.id][8]),
         // deadline: getDate(eventData[req.params.id][9]),
         // venue: eventData[req.params.id][5], // get using SQL
         // desc: eventData[req.params.id][3],
         // status: eventData[req.params.id][12],
         user: "ATTENDEE",
         name: eventData[req.params.id][2],
         type: eventData[req.params.id][4], // get using SQL
         date: getDate(eventData[req.params.id][7]),
         time: getTime(eventData[req.params.id][8]),
         deadline: getDate(eventData[req.params.id][9]),
         venue: eventData[req.params.id][5], // get using SQL
         desc: eventData[req.params.id][3],
         status: 1,
      });
   }
);

/*
   [Object: null prototype] {
   name: 'dance',
   description: 'dancing people',
   date: '2024-04-09',
   time: '12:00',
   venue: 'ACADEMIC BLOCK-4 301',
   deadline: '2024-04-08',
   fee: '0',
   eventType: 'ET1'
   }

   ATTENDEE_ID -> null
   EVENT_ID -> gen
   EVENT_NAME -> have
   EVENT_DESCRIPTION -> have
   EVENT_TYPE_ID -> have
   VENUE_ID -> map
   ORGANIZER_ID -> have
   EVENT_DATE -> have
   EVENT_TIME -> have
   REGISTRATION_DEADLINE -> have
   REGISTRATION_ID -> null
   REGISTRATION_DATE -> null
   PAYMENT_STATUS_ID -> null
*/

app.get("/query", async (req, res) => {
   try {
      const connection = await oracledb.getConnection(dbConfig);

      const result = await connection.execute(
         `select * from EVENTS where ORGANIZER_ID = (select ORGANIZER_ID from ORGANIZERS where EMAIL = '${req.user[2]}')`
      );

      await connection.close();
      res.json(result.rows);
   } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching data from OracleDB" });
   }
});

app.get("/test", async (req, res) => {
   try {
      const connection = await oracledb.getConnection(dbConfig);

      // const result = await connection.execute(
      //    "select * from attendee_organizer_combined"
      // );

      const result = await connection.execute("select * from events");

      result.metaData.forEach((data) => console.log(data.name));
      result.metaData.forEach((data) => console.log(data.name));

      await connection.close();
      res.json(result.rows);
   } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching data from OracleDB" });
   }
});

/*
req.user ->
ID = 0
NAME = 1
EMAIL = 2
PASSWORD = 3
PHONE = 4
LOCATION = 5
TYPE = 6
*/

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}`);
});
