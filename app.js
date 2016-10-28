var express = require('express');
var app = express();

var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var moment = require('moment');
var querystring = require('querystring');
var outlook = require('node-outlook');
var nodemailer = require('nodemailer');
var schedule = require('node-schedule');
//var Client = require('node-rest-client').Client;

// Very basic HTML templates
var pages = require('./pages');
var authHelper = require('./authHelper');

// Configure express
// Set up rendering of static files
app.use(express.static('static'));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
  });

// Need JSON body parser for most API responses
app.use(bodyParser.json());
// Set up cookies and sessions to save tokens
app.use(cookieParser());
app.use(session(
  { secret: '0dc529ba-5051-4cd6-8b67-c9a901bb8bdf',
    resave: false,
    saveUninitialized: false
  }));

// Home page
app.get('/', function(req, res) {
  res.send(pages.loginPage(authHelper.getAuthUrl()));
});


app.get('/hello', function(req, res) {
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
                user: 'sreid1234@gmail.com', // Your email id
                pass: 'samuel93' // Your password
            }
        });

    var mailOptions = {
        from: '<sreid1234@gmail.com>', // sender address
        to: 'sreid@teampareto.com', // list of receivers
        subject: 'Hello', // Subject line
        text: 'Hello world', // plaintext body
        html: '<b>Hello world</b>' // html body
    };

    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
    res.render('pages/hello');
});

app.get('/authorize', function(req, res) {
  var authCode = req.query.code;
  if (authCode) {
    console.log('');
    console.log('Retrieved auth code in /authorize: ' + authCode);
    authHelper.getTokenFromCode(authCode, tokenReceived, req, res);
  }
  else {
    // redirect to home
    console.log('/authorize called without a code parameter, redirecting to login');
    res.redirect('/');
  }
});

function tokenReceived(req, res, error, token) {
  if (error) {
    console.log('ERROR getting token:'  + error);
    res.send('ERROR getting token: ' + error);
  }
  else {
    // save tokens in session
    req.session.access_token = token.token.access_token;
    req.session.refresh_token = token.token.refresh_token;
    req.session.email = authHelper.getEmailFromIdToken(token.token.id_token);
    res.redirect('/logincomplete');
  }
}

app.get('/logincomplete', function(req, res) {
  var access_token = req.session.access_token;
  var refresh_token = req.session.access_token;
  var email = req.session.email;

  if (access_token === undefined || refresh_token === undefined) {
    console.log('/logincomplete called while not logged in');
    res.redirect('/');
    return;
  }

  res.send(pages.loginCompletePage(email));
});

app.get('/refreshtokens', function(req, res) {
  var refresh_token = req.session.refresh_token;
  if (refresh_token === undefined) {
    console.log('no refresh token in session');
    res.redirect('/');
  }
  else {
    authHelper.getTokenFromRefreshToken(refresh_token, tokenReceived, req, res);
  }
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

app.get('/sync', function(req, res) {
  var token = req.session.access_token;
  var email = req.session.email;
  if (token === undefined || email === undefined) {
    console.log('/sync called while not logged in');
    res.redirect('/');
    return;
  }

  // Set the endpoint to API v2
  outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');
  // Set the user's email as the anchor mailbox
  outlook.base.setAnchorMailbox(req.session.email);
  // Set the preferred time zone
  outlook.base.setPreferredTimeZone('Eastern Standard Time');

  // Use the syncUrl if available
  var requestUrl = req.session.syncUrl;
  if (requestUrl === undefined) {
    // Calendar sync works on the CalendarView endpoint
    requestUrl = outlook.base.apiEndpoint() + '/me/messages';
  }

  // Set up our sync window from midnight on the current day to
  // midnight 7 days from now.
  var startDate = moment().startOf('day');
  var endDate = moment(startDate).add(7, 'days');
  // The start and end date are passed as query parameters
  var params = {
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString()
  };

  var queryParams = {
  '$select': 'Subject,ReceivedDateTime,From,Body,IsRead,WebLink',
  '$orderby': 'ReceivedDateTime desc',
  //top controls the number of messages that are brought in by API call
  '$top': 12
    };

  // Set the required headers for sync
  var headers = {
    Prefer: [
      // Enables sync functionality
      //'outlook.allow-unsafe-html'
    //   'odata.track-changes',
    //   // Requests only 5 emails per response
        'odata.maxpagesize=5'
    ]
  };

  var apiOptions = {
    url: requestUrl,
    token: token,
    //headers: headers,
    //this needs to be odataParams
    odataParams: queryParams
  };

  function makeCall (apiOptions, check) {

    outlook.mail.getMessages(apiOptions, function(error, response) {
        if (error) {
          console.log(JSON.stringify(error));
          res.send(JSON.stringify(error));
        }
        else {

            var yolo = response['@odata.context'];
            var eachEmail = response['value'];

            //console.log(yolo);
            //console.log(eachEmail);

            //console.log(eachEmail.length);

            var stoppingPoint = eachEmail.length;

            var insideEmail = eachEmail[0]['Subject'];

            var insideEmail2 = eachEmail[1]['IsRead'];

            //console.log(insideEmail);
            //console.log(insideEmail2);

            var i = 0;
            var unReadEmails = [];

            function checkIsRead (eachEmail, stoppingPoint, unReadEmails, i) {
                while (i != eachEmail.length) {
                    if (eachEmail[i]['IsRead'] === false) {
                        unReadEmails.push(eachEmail[i]);
                        i += 1;
                    }
                    else {
                        i += 1;
                    }

                }
                return unReadEmails;
            }

            checkIsRead(eachEmail, stoppingPoint, unReadEmails, i);

            console.log(unReadEmails);

            var getBody = unReadEmails[1]['Body'];

            var getBody2 = unReadEmails[2]['Body'];

            // variables for makeGetBodyArray function
            var getBodyArray = [];
            var lengthUnReadEmails = unReadEmails.length;
            var f = 0;

            function makeGetBodyArray(getBodyArray, lengthUnReadEmails, unReadEmails, f) {
                while (f != lengthUnReadEmails) {
                    getBodyArray.push(unReadEmails[f]['Body']);
                    f++;
                }
                return getBodyArray;
            }

            makeGetBodyArray(getBodyArray, lengthUnReadEmails, unReadEmails, f);
            // provided as example for how to access Content
            var getInnerBody = getBody['Content'];

            // variables for makeGetContentArray function
            var getContentArray = [];
            var lengthGetBodyArray = getBodyArray.length;
            var g = 0;

            function makeGetContentArray(getContentArray, lengthGetBodyArray, getBodyArray, g) {
                while (g != lengthGetBodyArray) {
                    getContentArray.push(getBodyArray[g]['Content']);
                    g++;
                }
                return getContentArray;
            }

            makeGetContentArray(getContentArray, lengthGetBodyArray, getBodyArray, g);

            console.log(getContentArray);

            // provided as example for how to access Subject
            // pulls directly from unReadEmails (no nesting)
            var getSubject = unReadEmails[1]['Subject'];

            // variable for makeGetSubjectArray function
            var getSubjectArray = [];
            var h = 0;

            function makeGetSubjectArray(getSubjectArray,lengthUnReadEmails, unReadEmails, h) {
                while (h != lengthUnReadEmails) {
                    getSubjectArray.push(unReadEmails[h]['Subject']);
                    h++;
                }
                return getSubjectArray;
            }

            makeGetSubjectArray(getSubjectArray, lengthUnReadEmails, unReadEmails, h);

            // provided as example for how to access WebLink
            // pulls directly from unReadEmails (no nesting)
            var getLink = unReadEmails[1]['WebLink'];

            console.log(getSubjectArray);

            // variable for makeGetSubjectArray function
            var getWebLinkArray = [];
            var m = 0;

            function makeGetWebLinkArray(getWebLinkArray,lengthUnReadEmails, unReadEmails, m) {
                while (m != lengthUnReadEmails) {
                    //console.log(unReadEmails[m]['WebLink']);
                    getWebLinkArray.push(unReadEmails[m]['WebLink']);
                    m++;
                }
                return getWebLinkArray;
            }

            makeGetWebLinkArray(getWebLinkArray, lengthUnReadEmails, unReadEmails, m);

            //console.log(getWebLinkArray[0]);


            var getFrom = unReadEmails[0]['From'];

            // variables for makeGetFromArray function
            var getFromArray = [];
            var c = 0;

            function makeGetFromArray(getFromArray, lengthUnReadEmails, unReadEmails, c) {
                while (c != lengthUnReadEmails) {
                    console.log(unReadEmails[c]['From']);
                    getFromArray.push(unReadEmails[c]['From']);
                    c++;
                }
                return getFromArray;
            }

            makeGetFromArray(getFromArray, lengthUnReadEmails, unReadEmails, c);

            //console.log(getFromArray[0]);

            // variables for makeGetNameArray function
            var getNameArray = [];
            var lengthGetFromArray = getFromArray.length;
            var d = 0;

            function makeGetNameArray(getNameArray, lengthGetFromArray, getFromArray, d) {
                while (d != lengthGetFromArray) {
                    getNameArray.push(getFromArray[d]['EmailAddress']);
                    d++;
                }
                return getNameArray;
            }

            makeGetNameArray(getNameArray, lengthGetFromArray, getFromArray, d);

            var getName = getFrom['EmailAddress'];
            var getEmail = getName['Address'];

            // variables for makeGetEmailArray function
            var getNameArrayLength = getNameArray.length;
            var getEmail = [];
            var e = 0;

            function makeGetEmailArray(getNameArray, getNameArrayLength, getEmail, e) {
                while (e != getNameArrayLength) {
                    if (getNameArray[e]['Address'] !== undefined) {
                        getEmail.push(getNameArray[e]['Address']);
                    }
                    e++;
                }
                return getEmail;
            }

            makeGetEmailArray(getNameArray, getNameArrayLength, getEmail, e);

            console.log(getEmail);

            var k = 0;
            var t = 0;

            function findDomainName(getDomain, k, t, getEmail) {
                while (getEmail[k][t] != '@') {
                    t++;
                }
                var theEmailDomain = getEmail[k].substring(k, getEmail[k].length);
                return theEmailDomain;
            }

            var getEmailLength = getEmail.length;
            var domainArray = [];

            function getDomainNames(getEmailLength, k, t, getEmail)
            {
                while (k != getEmailLength) {
                    var getDomain1 = findDomainName(getDomain1, k, t, getEmail);
                    domainArray.push(getDomain1);
                    k++;
                }
                return domainArray;
            }

            getDomainNames(getEmailLength, k, t, getEmail);

            // //Need to error check for undefined json objects
            // if (getEmail[k] !== undefined) {
            //     var getDomain1 = findDomainName(getDomain1, k, t, getEmail);
            // }
            // //console.log(getBody);

            // console.log(domainArray[0]);
            //
            // console.log(getInnerBody[160]);
            //
            // console.log(getEmail[1]);

            // bring getContentArray in here instead of getInnerBody
            // think of getContentArray as array of getInnerBodies

            var lengthGetContentArray = getContentArray.length;
            p = 0;
            finalFormArray = [];
            function grabBodyTextWrapper(getContentArray, lengthGetContentArray, p, finalFormArray, getWebLinkArray, getSubjectArray) {

                while (p !== lengthGetContentArray) {

                    // var bodyAndBeyond = getInnerBody.substring(160, getInnerBody.length);
                    var bodyAndBeyond = getContentArray[p].substring(160, getContentArray[p].length);
                    var r = 0;
                    function grabBodyText (bodyAndBeyond) {
                        while (bodyAndBeyond[r] != '<') {
                            r++;
                        }
                        if (bodyAndBeyond[r+1] === '/') {
                            return bodyAndBeyond.substring(0, r);
                        }
                        else {
                            return 'No Subject';
                        }
                    }

                var allTheBodyText = grabBodyText(bodyAndBeyond);

                //console.log(allTheBodyText);

                // configuring the message

                var getSubjectWithLink = getSubjectArray[p].link(getWebLinkArray[p]);

                var subject = "Subject: ";

                var subjectBold = subject.bold();
                // information to forward on to user
                var allTogetherNow = subjectBold + getSubjectWithLink + "<br>" + allTheBodyText;
                finalFormArray.push(allTogetherNow);
                p++;
            }
            return finalFormArray;
        }

            grabBodyTextWrapper(getContentArray, lengthGetContentArray, p, finalFormArray, getWebLinkArray, getSubjectArray);
            console.log(finalFormArray);

            // configuring output to be sent to user via nodemailer
            var lengthfinalFormArray = finalFormArray.length;
            var w = 0;
            //var theMessage = 'Your Daily Mail';

            function whatToSend(finalFormArray, w, lengthfinalFormArray) {
                var theMessage = '';
                while (w != lengthfinalFormArray) {
                    theMessage += finalFormArray[w];
                    w++;
                    return theMessage;
                }
            }

            var theMessage = 'Your Daily Digest' + '<br>' + '<br>';
            while (w != lengthfinalFormArray) {
                theMessage += finalFormArray[w];
                theMessage += '<br>';
                theMessage += '<br>';
                w++;
            }

            //var whatToPrint = finalFormArray[w] + "<br>" + finalFormArray[w+1]

            //var sendTheMessage = whatToSend(finalFormArray, w, lengthfinalFormArray);

            var transporter = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                        user: 'sreid1234@gmail.com', // Your email id
                        pass: 'samuel93' // Your password
                    }
                });

            var mailOptions = {
                from: '<sreid1234@gmail.com>', // sender address
                to: 'sreid@teampareto.com', // list of receivers
                subject: 'Email Tiger', // Subject line
                //text: JSON.stringify(unReadEmails), // plaintext body
                // text: allTogetherNow,
                html: theMessage, // html body
            };

            transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    return console.log(error);
                }
                console.log('Message sent: ' + info.response);
            });

            //res.write('Success!');
            res.write('<h1>Success!</h1>');
            //return;
          }
      });
  }




  // makeCall(apiOptions);

 //  // call the Outlook API each day
 //  var rule = new schedule.RecurrenceRule();
 //  // rule.dayOfWeek = [0, new schedule.Range(0, 7)];
 //  // rule.hour = 7;
 //  rule.minute = 32;
 //
 //  var j = schedule.scheduleJob(rule, function(){
 //   makeCall(apiOptions);
 // });

  // call the Outlook API each day
  // var rule = new schedule.RecurrenceRule();

  // rule.dayOfWeek = [0, new schedule.Range(0, 7)];
  // rule.hour = 7;
  //rule.minute = 32;
  // rule.second = 10;

  // var j = schedule.scheduleJob(rule, function(){
   //console.log("Is this shit on?");
 makeCall(apiOptions);
 // });

});

app.get('/viewitem', function(req, res) {
  var itemId = req.query.id;
  var access_token = req.session.access_token;
  var email = req.session.email;

  if (itemId === undefined || access_token === undefined) {
    res.redirect('/');
    return;
  }

  var select = {
    '$select': 'Subject,Attendees,Location,Start,End,IsReminderOn,ReminderMinutesBeforeStart'
  };

  var getEventParameters = {
    token: access_token,
    eventId: itemId,
    odataParams: select
  };

  outlook.calendar.getEvent(getEventParameters, function(error, event) {
    if (error) {
      console.log(error);
      res.send(error);
    }
    else {
      res.send(pages.itemDetailPage(email, event));
    }
  });
});

app.get('/updateitem', function(req, res) {
  var itemId = req.query.eventId;
  var access_token = req.session.access_token;

  if (itemId === undefined || access_token === undefined) {
    res.redirect('/');
    return;
  }

  var newSubject = req.query.subject;
  var newLocation = req.query.location;

  console.log('UPDATED SUBJECT: ', newSubject);
  console.log('UPDATED LOCATION: ', newLocation);

  var updatePayload = {
    Subject: newSubject,
    Location: {
      DisplayName: newLocation
    }
  };

  var updateEventParameters = {
    token: access_token,
    eventId: itemId,
    update: updatePayload
  };

  outlook.calendar.updateEvent(updateEventParameters, function(error, event) {
    if (error) {
      console.log(error);
      res.send(error);
    }
    else {
      res.redirect('/viewitem?' + querystring.stringify({ id: itemId }));
    }
  });
});

app.get('/deleteitem', function(req, res) {
  var itemId = req.query.id;
  var access_token = req.session.access_token;

  if (itemId === undefined || access_token === undefined) {
    res.redirect('/');
    return;
  }

  var deleteEventParameters = {
    token: access_token,
    eventId: itemId
  };

  outlook.calendar.deleteEvent(deleteEventParameters, function(error, event) {
    if (error) {
      console.log(error);
      res.send(error);
    }
    else {
      res.redirect('/sync');
    }
  });
});

// // Start the server
// var https = require('https');
// var fs = require('fs');
//
// var options = {
//    key: fs.readFileSync('./key.pem', 'utf8'),
//    cert: fs.readFileSync('./cert.crt', 'utf8')
// };
//
// https.createServer(options, app).listen(3000, function () {
//    console.log('Started!');
// });

// Start the server
// var https = require('https');
// var fs = require('fs');
//
// var options = {
//    key: fs.readFileSync('./key.pem', 'utf8'),
//    cert: fs.readFileSync('./server.crt', 'utf8')
// };
//
// https.createServer(options, app).listen(3000, function () {
//    console.log('Started!');
// });
