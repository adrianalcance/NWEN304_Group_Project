var passport = require('passport');
var db = require('./config');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt-nodejs');
var oauth = require('./auth');
var FacebookStrategy = require('passport-facebook').Strategy;


passport.serializeUser(function (user, done) {
    done(null, user.emailaddress);
});

passport.deserializeUser(function (emailaddress, done) {
    db.any('select * from account where emailaddress=$1', [emailaddress])
        .then(data => {
            done(null, data);
        })
        .catch(error => {
            console.log('ERROR: ' + error);
        });
});

passport.use('local.signup', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    }, function (req, email, password, done) {
        /* set validator */
        req.checkBody('email', 'Invalid email').notEmpty().isEmail();
        req.checkBody('password', 'Invalid password, minimum length is 6').notEmpty().isLength({min: 6});
        var errors = req.validationErrors();
        if (errors) {
            var message = [];
            errors.forEach(error => {
                message.push(error.msg);
            });
            return done(null, false, req.flash('error', message));
        }
        /* create a user*/
        db.any('select * from account where emailaddress=$1', [email])
            .then(data => {
                if (data.length == 0) {
                    // crypt password
                    let newUser = {
                        emailaddress: email,
                        password: bcrypt.hashSync(password, null, null)
                    }
                    db.any('insert into account values(default,$1,$2,$3,false)'
                        , [newUser.emailaddress, newUser.password, newUser.emailaddress])
                        .then(data => {
                            //No error found, but user account exist
                            if (data.length > 0) {
                                return done(null, false, {message: 'Email is already in use.'});
                            }
                            //user account sign up successful
                            return done(null, newUser);
                        })
                        .catch(error => {
                            console.log('ERROR: ' + error);
                            return done(error);
                        });

                }
                else {
                    return done(null, false, {message: 'Email is already in use.'});
                }
            })
            .catch(error => {
                return done(error);
            });
    }
));

passport.use('local.signin', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    }, function (req, email, password, done) {
        /* set validator */
        req.checkBody('email', 'Invalid email').notEmpty().isEmail();
        req.checkBody('password', 'Invalid password, minimum length is 6').notEmpty().isLength({min: 6});
        var errors = req.validationErrors();
        if (errors) {
            var message = [];
            errors.forEach(error => {
                message.push(error.msg);
            });
            return done(null, false, req.flash('error', message));
        }
        db.any('select * from account where emailaddress=$1', [email])
            .then(data => {
                if (data.length > 0) {
                    // check password match
                    if (!bcrypt.compareSync(password, data[0].password)) {
                        return done(null, false, {message: 'Wrong password.'});
                    }
                    return done(null, data[0]);
                }
                else {
                    return done(null, false, {message: 'No user found.'});
                }
            })
            .catch(error => {
                console.log('ERROR: ' + error);
                return done(error);
            });
    }
));

passport.use(new FacebookStrategy({
        clientID: oauth.facebookAuth.clientID,
        clientSecret: oauth.facebookAuth.clientSecret,
        callbackURL: oauth.facebookAuth.callbackURL,
        profileFields: oauth.facebookAuth.profileFields
    },
    function (accessToken, refreshToken, profile, done) {
        db.any('select * from account where username=$1', [profile.id])
            .then(data => {
                if (data.length == 0) {
                    var newUser = {
                        username: profile.id,
                        emailaddress: profile.emails[0].value,
                        password: accessToken,
                        displayName: profile.name
                    }
                    db.any('insert into account values(default, $1,$2,$3,false)'
                        , [newUser.username, newUser.password, newUser.emailaddress])
                        .then(
                            data => {
                                if (data.length > 0) {
                                    return done(null, false, {message: 'Email is already in use.'});

                                }
                                return done(null, newUser);
                            }
                        )
                        .catch(error => {
                            console.log('Facebook ERROR: ' + error);
                            return done(error);
                        });

                }
                else {
                    return done(null, data[0]);
                }
            })
            .catch(error => {
                console.log('ERROR: ' + error);
            });
    }
));

