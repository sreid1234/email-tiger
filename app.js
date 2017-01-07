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

app.use(bodyParser.urlencoded({extended: true}));

var MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://sreid9:Reidlynx9@ds151677-a0.mlab.com:51677,ds151677-a1.mlab.com:51677/email-tiger?replicaSet=rs-ds151677',
    (err, database) => {
        if (err) return console.log(err);
        db = database;
});

// Very basic HTML templates
var pages = require('./pages');
var authHelper = require('./authHelper');

// Configure express
// Set up rendering of static files
app.use('/static', express.static(__dirname + '/static'));

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
    var token = req.session.access_token;
    var email = req.session.email;
    if (token === undefined || email === undefined) {
      console.log('/sync called while not logged in');
      res.redirect('/');
      return;
    }

    // shows priority emails from Mongo
    var path;
    db.collection('people').find({ email: req.session.email }).toArray(function(err, result) {
        path = result;
        var secondCheck = path[0];

        if (secondCheck === undefined) {
            res.render('pages/hello');
        }

        else {
            res.render('./pages/other.ejs', {people : result});
            }
        });

});

app.post('/quotes', (req, res) => {

    if (req.body.setting === undefined)
    {
        // need to add another template to handle this error
        res.redirect('/hello');
    }

    else if (req.body.setting.length == 2)
    {
        // need to add another template to handle this error
        res.redirect('/hello');
    }

    else {

        var path;
        db.collection('email', function(err, collection) {
            collection.find({ email: req.session.email }).toArray(function(err, results) {
                path = results;
                var secondCheck = path[0];

                if (secondCheck === undefined) {
                    console.log("where my dawgs at");
                     db.collection('email').save({email : req.session.email, setting:req.body.setting}, (err, result) => {
                         if (err) return console.log(err);

                         else if (req.body.setting == 'false') {
                             res.redirect('/hello');
                         }

                         else {
                             res.redirect('/sync-first');
                         }
                     });
                }

                else {
                    if (req.body.setting == 'false') {
                        collection.update( {email: req.session.email}, {email:req.session.email,  setting: false});
                        res.redirect('/sync-first');
                    }

                    else {
                        collection.update( {email: req.session.email}, {email:req.session.email,  setting: true});
                        res.redirect('/sync-first');
                    }
                }
            });
        });

        }
    });

    // add priority email
    app.post('/yoda', (req, res) => {

        if (req.body.names === "")
        {
            // need to add another template to handle this error
            res.redirect('/hello');
        }


        else {

            var path;
            db.collection('people', function(err, collection) {
                collection.find({ email: req.session.email }).toArray(function(err, results) {
                    path = results;

                    var secondCheck = path[0];
                    //console.log(path[0]);

                    //console.log(secondCheck._id);


                    if (secondCheck === undefined) {
                        console.log("this is so awesome");
                         db.collection('people').save( {email: req.session.email, names: [req.body.names]}, (err, result) => {
                             if (err) return console.log(err);

                             else {
                                 res.redirect('/hello');
                             }
                         });
                    }
                    else {
                        console.log("already have users in their DB");

                        db.collection('people').update( {_id: secondCheck._id , email: req.session.email }, { "$push": {names: req.body.names}}, (err, result) => {
                            if (err) return console.log(err);

                            else {
                                res.redirect('/hello');
                            }
                        })
                    }
                });
            });

            }
    });

    // remove priority email
    app.post('/delete', (req, res) => {

        var path;
        db.collection('people', function(err, collection) {
            collection.find({ email: req.session.email }).toArray(function(err, results) {
                path = results;
                var secondCheck = path[0];
                //db.collection('people').remove({ names: req.body.deletename });
                console.log("Time to Delete");

                db.collection('people').update( {_id: secondCheck._id , email: req.session.email }, { "$pull": { names: req.body.deletename }}, (err, result) => {
                    if (err) return console.log(err);

                    // else {
                    //     res.redirect('/hello');
                    // }
            });
        });
        res.redirect('/hello');

        });
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

  function makeCall (email) {

  // Set the endpoint to API v2
  outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');

  // Set the user's email as the anchor mailbox
  //outlook.base.setAnchorMailbox(req.session.email);
  // Variable changed to make scheduler work overnight //
  outlook.base.setAnchorMailbox(email);
  // Set the preferred time zone
  outlook.base.setPreferredTimeZone('Eastern Standard Time');

  // Use the syncUrl if available
  // var requestUrl = req.session.syncUrl;
  // if (requestUrl === undefined) {
    // Calendar sync works on the CalendarView endpoint
    requestUrl = outlook.base.apiEndpoint() + '/me/messages';
    //requestUrl = outlook.base.apiEndpoint() + '/me/MailFolders/deleteditems/messages';
  // }

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
  '$top': 100
    };

  // Set the required headers for sync
  var headers = {
    Prefer: [
      // Enables sync functionality
      //'outlook.allow-unsafe-html'
    //   'odata.track-changes',
    //   // Requests only 5 emails per response
    // Limiting results using $top will prevent odata.maxpagesize preference from being applied
        'odata.maxpagesize=5'
    ]
  };

  var apiOptions = {
    url: requestUrl,
    token: token,
    folderId: 'inbox',
    //headers: headers,
    //this needs to be odataParams
    odataParams: queryParams
  };



  //function makeCall (apiOptions)

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

            //console.log(unReadEmails);

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

            //console.log(getContentArray);


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

            //console.log(getSubjectArray);

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


            // variables for makeGetFromArray function
            var getFromArray = [];
            var c = 0;

            function makeGetFromArray(getFromArray, lengthUnReadEmails, unReadEmails, c) {
                while (c != lengthUnReadEmails) {
                    //console.log(unReadEmails[c]['From']);
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


            // variables for makeGetEmailArray function
            var getNameArrayLength = getNameArray.length;
            var getEmail = [];
            var e = 0;

            function makeGetEmailArray(getNameArray, getNameArrayLength, getEmail, e) {
                while (e != getNameArrayLength) {
                    if (getNameArray[e]['Address'] !== undefined) {
                        getEmail.push(getNameArray[e]['Address']);
                    }
                    else {
                        getEmail.push('N/A');
                    }
                    e++;
                }
                return getEmail;
            }

            makeGetEmailArray(getNameArray, getNameArrayLength, getEmail, e);

            //console.log(getEmail);

            var k = 0;
            var t = 0;

            function findDomainName(getDomain, k, t, getEmail) {

                if (getEmail[k] !== 'N/A') {

                    while (getEmail[k][t] != '@') {
                        t++;
                    }
                    var theEmailDomain = getEmail[k].substring(k, getEmail[k].length);
                    return theEmailDomain;
                }

                else {
                    return ('no-domain');
                }
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
            function grabBodyTextWrapper(getContentArray, lengthGetContentArray, p, finalFormArray, getWebLinkArray, getSubjectArray, getEmail) {

                while (p !== lengthGetContentArray) {

                    // var bodyAndBeyond = getInnerBody.substring(160, getInnerBody.length);
                    var bodyAndBeyond = getContentArray[p].substring(160, getContentArray[p].length);
                    var r = 0;
                    function grabBodyText (bodyAndBeyond) {
                        while (bodyAndBeyond[r] != '<') {
                            r++;
                        }
                        if ((bodyAndBeyond[r+1] === '/') && (bodyAndBeyond[r+3] === 'o')) {
                            return bodyAndBeyond.substring(0, r);
                        }
                        else {
                            return bodyAndBeyond.substring(0, r);
                        }
                    }

                var allTheBodyText = grabBodyText(bodyAndBeyond);

                //console.log(allTheBodyText);

                // configuring the message

                var getSubjectWithLink = getSubjectArray[p].link(getWebLinkArray[p]);

                var getSender = getEmail[p];

                var subject = "Subject: ";

                var subjectBold = subject.bold();

                var sender = "Sender: ";

                var senderBold = sender.bold();

                // information to forward on to user
                if (getSender !== 'N/A') {
                    var allTogetherNow = subjectBold + getSubjectWithLink + "<br>" + senderBold + getSender + "<br>" + allTheBodyText;
                    finalFormArray.push(allTogetherNow);
                    p++;
                }
                else {
                    var allTogetherNow2 = subjectBold + getSubjectWithLink + "<br>" + senderBold + getSender;
                    //could include emails sent from no sender
                    // finalFormArray.push(allTogetherNow2);
                    p++;
                }
            }
            return finalFormArray;
        }

            grabBodyTextWrapper(getContentArray, lengthGetContentArray, p, finalFormArray, getWebLinkArray, getSubjectArray, getEmail);
            //console.log(finalFormArray);

            // Get priority emails from DB //
            collection = db.collection('people');
            var arrayOfPriorityEmailsActual;
            var noPriorityEmails = [];
            var lengthfinalFormArray = finalFormArray.length;


            function rankPriorityEmails(finalFormArray, arrayOfPriorityEmailsActual, newFinalFormArray2) {
                var checker = 0;

                // user has priority emails
                if (arrayOfPriorityEmailsActual.length > 0) {

                    console.log("user has priority emails");

                    while (checker < finalFormArray.length) {
                        var i = finalFormArray[checker].search("Sender:");
                        //console.log(i);
                        i+=12;
                        var j=i;
                        var getThisEmail = '';
                        while (finalFormArray[checker][j] !== '<')
                        {
                            getThisEmail += finalFormArray[checker][j];
                            j+=1;
                        }
                        console.log(getThisEmail);
                        var t = 0;
                        var increment = true;
                        while (t < arrayOfPriorityEmailsActual.length) {
                            if (arrayOfPriorityEmailsActual[t] === getThisEmail)
                            {
                                newFinalFormArray2.push(finalFormArray[checker]);
                                finalFormArray.splice(checker,1);
                                increment = false;
                                break;
                            }
                            else {
                                t++;
                            }
                        }
                        i = 0;
                        j = 0;
                        t = 0;
                        if (increment === true)
                        {
                            checker += 1;
                        }

                    }
                    console.log(finalFormArray);
                    var c = 0;
                    while (c < finalFormArray.length)
                    {
                        newFinalFormArray2.push(finalFormArray[c]);
                        c ++;
                    }

                    return newFinalFormArray2;
                }

                // user has no priority emails
                else {
                    var n = 0;
                    while (n < finalFormArray.length)
                    {
                        newFinalFormArray2.push(finalFormArray[n]);
                        n ++;
                    }
                    return newFinalFormArray2;
                }

            }

            function getPriorityEmails(cb) {
                var path;
                var secondCheck;
                collection.find({ email: email}).toArray(function(err, results) {
                    path = results;
                    //secondCheck = path[0].names;
                    secondCheck = path[0];
                    if (secondCheck === undefined)
                    {
                        console.log("hey there");
                        cb(secondCheck);
                    }

                    else {
                        thirdCheck = secondCheck.names;
                        console.log(thirdCheck);
                        cb(thirdCheck);
                    }

                });
            }


            var newFinalFormArray2 = [];


            function wrapPriorityCallback(arrayOfPriorityEmailsActual, finalFormArray, newFinalFormArray2, noPriorityEmails) {

                getPriorityEmails(function(result){

                    //console.log(result.length);

                    if (result === undefined) {
                        rankPriorityEmails(finalFormArray, noPriorityEmails, newFinalFormArray2);
                    }

                    else if (result.length === 0) {
                        console.log("What's up");
                        console.log(noPriorityEmails);
                        rankPriorityEmails(finalFormArray, noPriorityEmails, newFinalFormArray2);

                    }

                    else {
                        // console.log(result);
                        // console.log("Righttt here");
                        arrayOfPriorityEmailsActual = result;
                        rankPriorityEmails(finalFormArray, arrayOfPriorityEmailsActual, newFinalFormArray2);
                    }

                    // else {
                    //     // console.log("down here");
                    //     rankPriorityEmails(finalFormArray, noPriorityEmails, newFinalFormArray2);
                    // }
                    // var newFinalFormArray = [];
                    //
                    // x = 0;
                    //
                    // var whichArrayCheck = false;
                    //
                    // if (newFinalFormArray2.length > 50) {
                    //     while (x < 50) {
                    //         newFinalFormArray.push(newFinalFormArray2[x]);
                    //         x ++;
                    //     }
                    //     whichArrayCheck = true;
                    // }

                    var lengthFinalFormArray2 = newFinalFormArray2.length;
                    // var lengthNewFinalFormArray = newFinalFormArray.length;
                    // var w = 0;
                    //
                    // function whatToSend(finalFormArray, w, lengthfinalFormArray) {
                    //     var theMessage = '';
                    //     while (w != lengthfinalFormArray) {
                    //         theMessage += finalFormArray[w];
                    //         w++;
                    //         return theMessage;
                    //     }
                    // }
                    //
                    // if (whichArrayCheck === false) {
                    //     whatToSend(newFinalFormArray2, w, lengthFinalFormArray2);
                    // }
                    //
                    // else {
                    //     whatToSend(newFinalFormArray, w, lengthNewFinalFormArray);
                    // }

                    var theMessage = 'Email Tiger - Your Recent Unread Emails' + '<br>' + '<br>';

                    // need to limit the number of unread emails included in one digest
                    var w = 0;
                    while (w != lengthFinalFormArray2) {
                        theMessage += newFinalFormArray2[w];
                        theMessage += '<br>';
                        theMessage += '<br>';
                        w++;
                    }

                    if (lengthFinalFormArray2 === 0) {
                        theMessage += 'You have no unread emails.';
                    }

                    //var whatToPrint = finalFormArray[w] + "<br>" + finalFormArray[w+1]

                    //var sendTheMessage = whatToSend(finalFormArray, w, lengthfinalFormArray);

                    var transporter = nodemailer.createTransport({
                        service: 'Gmail',
                        auth: {
                                //user: 'sreid1234@gmail.com',
                                // pass: 'samuel93'
                                user: 'unread@email-tiger.com',
                                pass: 'SamTiger9'
                            }
                        });

                    var mailOptions = {
                        from: '<unread@email-tiger.com>', // sender address
                        to: email, // list of receivers
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

                    // // call the Outlook API each day
                    // var rule = new schedule.RecurrenceRule();
                    // //rule.dayOfWeek = [0, new schedule.Range(1, 6)];
                    // //rule.hour = 0;
                    // //rule.minute = 2;
                    // rule.second = 10;
                    //
                    //
                    //   var j = schedule.scheduleJob(rule, function(){
                    //       console.log("---------");
                    //       console.log("Scheduler has been called!");
                    //       console.log("---------");
                    //       checkIfShouldMakeCall(email);
                    //  });

                });
            }

            wrapPriorityCallback(arrayOfPriorityEmailsActual, finalFormArray, newFinalFormArray2, noPriorityEmails);

        }
    });

    }




            // THIS CALLBACK WORKS //
            collection = db.collection('email');

            function compareDB(cb) {
                var path;
                var secondCheck;
                collection.find({ email: email }).toArray(function(err, results) {
                    path = results;
                    var secondCheck = path[0].setting;

                    cb(secondCheck);
                });
            }


            function checkIfShouldMakeCall(email) {

                var tnt = compareDB(function(result){
                    //console.log(result);
                    if (result === true) {
                        console.log("Get money");
                        makeCall(email);
                    }
                });

            }

            checkIfShouldMakeCall(email);
            res.redirect('/hello');


});

app.get('/sync-first', function(req, res) {
  var token = req.session.access_token;
  var email = req.session.email;
  if (token === undefined || email === undefined) {
    console.log('/sync called while not logged in');
    res.redirect('/');
    return;
  }

  function makeCall (email) {

  // Set the endpoint to API v2
  outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');

  // Set the user's email as the anchor mailbox
  //outlook.base.setAnchorMailbox(req.session.email);
  // Variable changed to make scheduler work overnight //
  outlook.base.setAnchorMailbox(email);
  // Set the preferred time zone
  outlook.base.setPreferredTimeZone('Eastern Standard Time');

  // Use the syncUrl if available
  // var requestUrl = req.session.syncUrl;
  // if (requestUrl === undefined) {
    // Calendar sync works on the CalendarView endpoint
    requestUrl = outlook.base.apiEndpoint() + '/me/messages';
    //requestUrl = outlook.base.apiEndpoint() + '/me/MailFolders/deleteditems/messages';
  // }

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
  '$top': 75
    };

  // Set the required headers for sync
  var headers = {
    Prefer: [
      // Enables sync functionality
      //'outlook.allow-unsafe-html'
    //   'odata.track-changes',
    //   // Requests only 5 emails per response
    // Limiting results using $top will prevent odata.maxpagesize preference from being applied
        'odata.maxpagesize=5'
    ]
  };

  var apiOptions = {
    url: requestUrl,
    token: token,
    folderId: 'inbox',
    //headers: headers,
    //this needs to be odataParams
    odataParams: queryParams
  };



  //function makeCall (apiOptions)

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

            //console.log(unReadEmails);

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

            //console.log(getContentArray);


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

            //console.log(getSubjectArray);

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


            // variables for makeGetFromArray function
            var getFromArray = [];
            var c = 0;

            function makeGetFromArray(getFromArray, lengthUnReadEmails, unReadEmails, c) {
                while (c != lengthUnReadEmails) {
                    //console.log(unReadEmails[c]['From']);
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


            // variables for makeGetEmailArray function
            var getNameArrayLength = getNameArray.length;
            var getEmail = [];
            var e = 0;

            function makeGetEmailArray(getNameArray, getNameArrayLength, getEmail, e) {
                while (e != getNameArrayLength) {
                    if (getNameArray[e]['Address'] !== undefined) {
                        getEmail.push(getNameArray[e]['Address']);
                    }
                    else {
                        getEmail.push('N/A');
                    }
                    e++;
                }
                return getEmail;
            }

            makeGetEmailArray(getNameArray, getNameArrayLength, getEmail, e);

            //console.log(getEmail);

            var k = 0;
            var t = 0;

            function findDomainName(getDomain, k, t, getEmail) {

                if (getEmail[k] !== 'N/A') {

                    while (getEmail[k][t] != '@') {
                        t++;
                    }
                    var theEmailDomain = getEmail[k].substring(k, getEmail[k].length);
                    return theEmailDomain;
                }

                else {
                    return ('no-domain');
                }
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
            function grabBodyTextWrapper(getContentArray, lengthGetContentArray, p, finalFormArray, getWebLinkArray, getSubjectArray, getEmail) {

                while (p !== lengthGetContentArray) {

                    // var bodyAndBeyond = getInnerBody.substring(160, getInnerBody.length);
                    var bodyAndBeyond = getContentArray[p].substring(160, getContentArray[p].length);
                    var r = 0;
                    function grabBodyText (bodyAndBeyond) {
                        while (bodyAndBeyond[r] != '<') {
                            r++;
                        }
                        if ((bodyAndBeyond[r+1] === '/') && (bodyAndBeyond[r+3] === 'o')) {
                            return bodyAndBeyond.substring(0, r);
                        }
                        else {
                            return bodyAndBeyond.substring(0, r);
                        }
                    }

                var allTheBodyText = grabBodyText(bodyAndBeyond);

                //console.log(allTheBodyText);

                // configuring the message

                var getSubjectWithLink = getSubjectArray[p].link(getWebLinkArray[p]);

                var getSender = getEmail[p];

                var subject = "Subject: ";

                var subjectBold = subject.bold();

                var sender = "Sender: ";

                var senderBold = sender.bold();

                // information to forward on to user
                if (getSender !== 'N/A') {
                    var allTogetherNow = subjectBold + getSubjectWithLink + "<br>" + senderBold + getSender + "<br>" + allTheBodyText;
                    finalFormArray.push(allTogetherNow);
                    p++;
                }
                else {
                    var allTogetherNow2 = subjectBold + getSubjectWithLink + "<br>" + senderBold + getSender;
                    //could include emails sent from no sender
                    // finalFormArray.push(allTogetherNow2);
                    p++;
                }
            }
            return finalFormArray;
        }

        grabBodyTextWrapper(getContentArray, lengthGetContentArray, p, finalFormArray, getWebLinkArray, getSubjectArray, getEmail);

        var theMessage = 'Your Daily Digest' + '<br>' + '<br>';

        var w = 0;
        while (w != finalFormArray.length) {
            theMessage += finalFormArray[w];
            theMessage += '<br>';
            theMessage += '<br>';
            w++;
        }

        if (finalFormArray.length === 0) {
            theMessage += 'You have no unread emails.';
        }

        //var whatToPrint = finalFormArray[w] + "<br>" + finalFormArray[w+1]

        //var sendTheMessage = whatToSend(finalFormArray, w, lengthfinalFormArray);

        var transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                    //user: 'sreid1234@gmail.com',
                    // pass: 'samuel93'
                    user: 'unread@email-tiger.com',
                    pass: 'SamTiger9'
                }
            });

        var mailOptions = {
            from: '<unread@email-tiger.com>', // sender address
            to: email, // list of receivers
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

    }
});

}




            // THIS CALLBACK WORKS //
            collection = db.collection('email');

            function compareDB(cb) {
                var path;
                var secondCheck;
                collection.find({ email: email }).toArray(function(err, results) {
                    path = results;
                    var secondCheck = path[0].setting;

                    cb(secondCheck);
                });
            }


            function checkIfShouldMakeCall(email) {

                var tnt = compareDB(function(result){
                    //console.log(result);
                    if (result === true) {
                        console.log("Get money");
                        makeCall(email);
                    }
                });

            }

            checkIfShouldMakeCall(email);
            res.redirect('/hello');


});
