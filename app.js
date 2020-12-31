const express = require('express');
const { google } = require('googleapis');
const OAuth2Data = require("./credentials.json");
const multer = require('multer');
const fs = require('fs');

const app = express();

const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URL = OAuth2Data.web.redirect_uris[0];

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URL
  );

var authed = false;
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile";

app.set("view engine", 'ejs');


const Storage = multer.diskStorage({
    destination: function (req, file, callback) {
      callback(null, "./images");
    },
    filename: function (req, file, callback) {
      callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
    },
  });
  
const upload = multer({
    storage: Storage,
}).single("file"); //Field name and max count

var userName, userImage;
app.get('/', (req, res) => {
    if(!authed){
        var url = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
          });
        // console.log(url);

        res.render('index',{url:url});
    }else{
        // res.render("success");
        var oauth2 = google.oauth2({
            auth: oAuth2Client,
            version: "v2",
        });

        // user info
        oauth2.userinfo.get( (err,response) => {
            if(err) throw err;

            userName = response.data.name;
            userImage = response.data.picture;

            res.render('success', { name: userName, pic: userImage, success: false});
        })
    }
});

app.get('/google/callback' , (req,res) => {
    const code = req.query.code;
    if(code){
        oAuth2Client.getToken(code, (err,tokens) => {
            if(err){
                console.log("Error in Authenticating",err);
            }else{
                console.log("authetication successful");
                oAuth2Client.setCredentials(tokens);

                authed = true;
                res.redirect('/');
            }
        })
    }
});

// Upload files to drive
app.post('/upload', (req, res)=> {
    upload(req, res, (err) => {
        if (err) throw err;
        // console.log(req.file.path);

        const drive = google.drive({
            version: "v3",
            auth: oAuth2Client,
        });

        const folderId = '12_jskHPXQ1c18xwl0b6ucoENGqLEauin';
        const filemetadata = {
            name: req.file.filename,
            parents: [folderId]
        }

        const media = {
            mimetype : req.file.mimetype,
            body: fs.createReadStream(req.file.path)
        }

        drive.files.create({
            resource: filemetadata,
            media,
            fields: 'id'
        },(err, file) => {
            if(err) throw err;

            // if no error then delete that file from image folder
            fs.unlinkSync(req.file.path);
            res.render('success', { name: userName, pic: userImage, success: true});
        })
    })
})

const port = 5500 || process.env.PORT;

app.listen(port, () => {
    console.log(`App started at ${port}`); 
})