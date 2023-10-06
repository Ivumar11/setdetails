// server.js
const express = require('express');
const multer = require('multer'); // Middleware for handling file uploads
const path = require('path');
const fs = require('fs');
require("dotenv").config();
const app = express();
const port = process.env.PORT;


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

// Set up storage for uploaded files
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (file.mimetype == "text/plain") cb(null, true)
  else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'))
}
const upload = multer({ storage, fileFilter });

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle file upload
app.post('/upload', upload.single('file'), async (req, res) => {

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
          console.log({domain, pattern})
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
    
    const fileName = `${req.ip}-processed.txt`
    fs.writeFileSync(fileName, contents.join('\n'))
    //res.download(fileName)

     // Set the response headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename=processed.txt');
    res.setHeader('Content-Type', 'text/plain');

    const fileStream = fs.createReadStream(fileName)
    fileStream.pipe(res)

    fileStream.on("end", () => {
      fs.unlinkSync(fileName);
    })
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
