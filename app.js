require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook");
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(
  `mongodb+srv://jamal:${process.env.DB_PASSWORD}@cluster0.pgauj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`,
  { useNewUrlParser: true }
);

const usersSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  facebookId: String,
  displayName: String,
  picture: String,
  secret: [String],
});

usersSchema.plugin(passportLocalMongoose);
usersSchema.plugin(findOrCreate);

const User = mongoose.model("User", usersSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  //In serialize user you decide what to store in the session. Here I'm storing the user id only.
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  //Here you retrieve all the info of the user from the session storage using the user id stored in the session earlier using serialize user.
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

var thisProfile;
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      const picture = profile.photos[0].value;
      User.findOrCreate(
        {
          googleId: profile.id,
          displayName: profile.displayName,
          picture: picture,
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "http://localhost:3000/auth/facebook/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      const picture = `https://graph.facebook.com/${profile.id}/picture?width=200&height=200&access_token=${accessToken}`;
      User.findOrCreate(
        {
          facebookId: profile.id,
          displayName: profile.displayName,
          picture: picture,
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

let routes = [
  "",
  "home",
  "auth/google",
  "auth/google/secrets",
  "auth/facebook",
  "auth/facebook/secrets",
  "login",
  "register",
  "submit",
  "secrets",
  "logout",
  "submit",
  "profile",
  "jamal",
  "about",
];

app.get("/", (req, res) => {
  res.render("home");
});
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);
app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/profile");
  }
);
app.get("/auth/facebook", passport.authenticate("facebook"));

app.get(
  "/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/profile");
  }
);
app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/profile");
  } else {
    res.render("login");
  }
});
app.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/profile");
  } else {
    res.render("register");
  }
});
app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});
app.get("/secrets", (req, res) => {
  User.find({ secret: { $ne: null } }, (err, result) => {
    let isAuth = req.isAuthenticated();
    if (isAuth) {
      res.render("secrets", {
        secret: result,
        picture: req.user.picture ? req.user.picture : "images/defaultPic.jpg",
        displayName: req.user.displayName
          ? req.user.displayName
          : req.user.username,
        isAuth: isAuth,
      });
    } else {
      res.render("secrets", {
        secret: result,
        isAuth: isAuth,
      });
    }
  });
});
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});
app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});
app.get("/profile", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.secret) {
      res.render("profile", {
        secret: req.user.secret,
        picture: req.user.picture ? req.user.picture : "images/defaultPic.jpg",
        displayName: req.user.displayName
          ? req.user.displayName
          : req.user.username,
      });
    } else res.render("profile");
  } else {
    res.redirect("/Login");
  }
});
app.get("/jamal", (req, res) => {
  res.render("jamal");
});
app.get("/about", (req, res) => {
  res.render("about");
});
app.get("/:route", (req, res) => {
  if (!routes.includes(req.params.route)) {
    res.render("notFound");
  }
});

app.post("/register", (req, res) => {
  User.register(
    { username: req.body.username },
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/Register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/profile");
        });
      }
    }
  );
});

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, (err) => {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/profile");
      });
    }
  });
});

app.post("/submit", (req, res) => {
  const postedSecret = req.body.secret;
  User.findById(req.user._id, (err, result) => {
    if (err) console.log(err);
    else if (result) {
      result.secret.push(postedSecret);
      result.save(() => {
        res.redirect("/profile");
      });
    }
  });
});

app.post("/profile", (req, res) => {
  let index = req.body.deleteBtn;
  User.findById(req.user._id, (err, result) => {
    result.secret.splice(index, 1);
    result.save(() => {
      res.redirect("/profile");
    });
  });
});



let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, () => {
  console.log("listening on port 3000");
});