const fs = require("fs");
const axios = require("axios");
const jsdom = require("jsdom");
const https = require("https");
const readline = require("readline-sync");
const path = require("path");


let baseDir = "";
let link = "";
let slash = path.sep;

getData();

async function getData() {
    try {
        let _baseDir = readline.question("Base Directory: ");
        let _folder = readline.question("Folder Name: ");
        let _originLink = readline.question("MangaHasu Link (Chapter): ");
        _baseDir = _baseDir.replaceAll("/", slash);
        _baseDir = _baseDir.replaceAll("\\", slash);
        if(!_baseDir.endsWith(slash)) _baseDir += slash;
        baseDir = _baseDir + _folder + slash;
        link = _originLink;
        if(!baseDir) {
            console.log("No base directory!");
            return;
        }
        if(!_folder) {
            console.log("No folder!");
            return;
        }
        if(!link) {
            console.log("No link!");
            return;
        }
        if (!fs.existsSync(baseDir)){
            fs.mkdirSync(baseDir, { recursive: true });
        }
        let data = await axios.get(link, {
            headers: {
                Referer: "https://mangahasu.me/",
            }
        });
        let document = new jsdom.JSDOM(data.data).window.document;
        let imgList = [];
        document.querySelectorAll(".img img").forEach(s => {
            if(s.getAttribute("src")) {
                imgList.push(s.getAttribute("src"));
            }
        });
        let index = 0;
        for(let img of imgList) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            console.log(`${index + 1}: ${img}`);
            downloadImage(img, baseDir + `${(index + 1).toString().padStart(imgList.length.toString().length, '0')}.${img.split(".").pop(-1)}`);
            index++;
        }
    }
    catch (err) {
        console.log(err);
    }
}

function downloadImage(url, filepath, retry = 1) {
    const file = fs.createWriteStream(filepath);
    https.get(url, {
        headers: {
            Referer: "https://mangahasu.me/",
        }
    }, function (response) {
        response.pipe(file);

        if(response.statusCode == 200) {
            file.on("finish", () => {
                console.log(`Finish ${filepath}`)
                file.close();
            });
        }
        else {
            // file.on("finish", () => {
            //     file.destroy();
            // });
        }
    }).on("error", (error) => {
        if(retry <= 60) {
            console.log(`Try connecting again #${retry} for ${url}...`);
            downloadImage(url, filepath, retry + 1);
        }
        else {
            throw error;
        }
    });
}