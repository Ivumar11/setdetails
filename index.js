// server.js
const express = require('express');
const multer = require('multer'); // Middleware for handling file uploads
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const randomString = require('randomstring');
require("dotenv").config();
const app = express();
const port = process.env.PORT;
const registered_users = "registered_users.txt"

function setDetail(pattern, content, domain) {
  let names = content.trim().split(" ").filter(name => name != "");
  if (names.length <= 1) return "";

  let mail = ""

  if (pattern.startsWith("first")) {
    mail+=names[0];
    if (pattern.length > 5 && pattern[5] != "l") mail+= pattern[5];
    if (pattern.endsWith("last")) mail+= names[names.length-1];
    else if (pattern.endsWith("l")) mail+= names[names.length-1][0];
  }
  else if (pattern.startsWith("f")) {
    mail+=names[0][0];
    if (pattern.length > 1 && pattern[1] != "l") mail+= pattern[1];
    if (pattern.endsWith("last")) mail+= names[names.length-1];
    else if (pattern.endsWith("l")) mail+= names[names.length-1][0];
  }
  else if (pattern.startsWith("last")) {
    mail+=names[names.length-1];
    if (pattern.length > 4 && pattern[4] != "f") mail+= pattern[4];
    if (pattern.endsWith("first")) mail+= names[0];
    else if (pattern.endsWith("f")) mail+= names[0][0];
  }
  else if (pattern.startsWith("l")) {
    mail+=names[names.length-1][0];
    if (pattern.length > 1 && pattern[1] != "f") mail+= pattern[1];
    if (pattern.endsWith("first")) mail+= names[0];
    else if (pattern.endsWith("f")) mail+= names[0][0];
  }
  else {
    mail = pattern
  }

  if (mail == pattern) return "";
  mail = ('\n' + mail + '@' + domain).toLowerCase()
  return mail;
}

class UnauthenticatedError extends Error {
  constructor (message) {
    super(message)
    this.statusCode = 401;
  }
}

const verifyToken = async (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.EN_KEY, (err, payload) => {
      if (err) {
        return reject(err);
      } else {
        resolve(payload);
      }
    });
  });
};

async function validateIp (req, res, next) {
  try {
    let data = await fsPromises.readFile(registered_users, 'utf8');
    data = data.split("\n")

    for (const line of data) {
      const userCred = line.split("=")[1];
      if (!userCred) continue;
      if (userCred === req.signedCookies.authCredential) {
        await verifyToken(req.signedCookies.authCredential);
        return next()
      }
    }
    throw new Error();
  } catch (error) {
    next(new UnauthenticatedError("You are not authorized to access this resource"))
  }
}

// Set up storage for uploaded files
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (file.mimetype == "text/plain") cb(null, true)
  else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'))
}
const upload = multer({ storage, fileFilter });

app.set('trust proxy', true);

app.use(cookieParser(process.env.EN_KEY));
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle file upload
app.post('/upload', upload.single('file'), validateIp, (req, res) => {

    let contents = req.file.buffer.toString('utf8').split('\n');
    let [pattern, domain] = ["", ""];
    let i = 0;

    while (i < contents.length) {
      if (contents[i].trim().startsWith("=")) {
        i++;
        while (i < contents.length && !(contents[i].includes('@'))) {
          i++
        }
        if (i != contents.length) {
          [pattern, domain] = contents[i].trim().split('@');
        }
        i++;
      } else {
        let content = contents[i].trim()
        if (content != '') {
          contents[i]+= setDetail(pattern, content, domain)
        }
        i++;
      }
      
    } 
    
    const fileName = `${req.signedCookies.authCredential}.txt`
    fs.writeFileSync(fileName, contents.join('\n'))

    // Set the response headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename=sermon.txt');
    res.setHeader('Content-Type', 'text/plain');

    const fileStream = fs.createReadStream(fileName)
    fileStream.pipe(res)

    fileStream.on("end", () => {
      fs.unlinkSync(fileName);
    })
});

app.get('/register', async (req, res, next) => {
  try {
    const name = "possible";
    const expiresIn = "31557600000";
    const payload = randomString.generate(10);
    let data = [];
    if (fs.existsSync(registered_users)) {
      data =  (await fsPromises.readFile(registered_users, 'utf8')).split('\n');
    }
    for (const line of data) {
      if (line.split("=")[0] == name) return res.send("You have been registered")
    }

    const signedStr = jwt.sign({payload}, process.env.EN_KEY, {expiresIn});

    res.cookie("authCredential", signedStr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      signed: true,
      maxAge: Number(expiresIn),
    })
    await fsPromises.appendFile(registered_users, `${name}=${signedStr}\n`, 'utf8');
    
    res.send("Device registered successfully");

  } catch (error) {
    next(error)
  }
})

app.get('/clear-file', (req, res) => {
  if (fs.existsSync(registered_users)) {
    fs.unlinkSync(registered_users);
    return res.send("Files cleared successfully")
  }
  res.send("No such file found")
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  if (err instanceof multer.MulterError) return res.status(400).json({ message: err.message})
  if (err instanceof UnauthenticatedError) return res.status(err.statusCode).json({message: err.message})
  res.status(500).send('Something broke! Please retry')
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
