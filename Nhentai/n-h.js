const fs = require("fs");
const axios = require("axios");
const jsdom = require("jsdom");
const https = require("https");
const readline = require("readline-sync");
const path = require("path");

let baseDir = "";
let link = "";
let numberOfImg = 0;
let images = [];
let title = "";
let slash = path.sep;

getData(0);

async function getData(page) {
    try {
        if(page > numberOfImg) return;
        if(!page) {
            let _baseDir = readline.question("Base Directory: ");
            let _originLink = readline.question("Nhentai Link: ");
            if(!_baseDir.endsWith(slash)) _baseDir += slash;
            if(!_originLink.endsWith("/")) _originLink += "/";
            baseDir = _baseDir;
            link = _originLink;
        }
        if(!baseDir) {
            console.log("No base directory!");
            return;
        }
        if(!link) {
            console.log("No link!");
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        let _l = link + (page ? `${page}/` : "");
        let data = await axios.get(_l);
        let document = new jsdom.JSDOM(data.data).window.document;
        if(!page) {
            title = document.querySelector("h1.title").textContent;
            let tags = document.querySelectorAll(".tag-container");
            tags.forEach(s => {
                if(s.textContent?.includes("Pages")) {
                    let numb = s.querySelector(".name").textContent;
                    numberOfImg = isNaN(parseInt(numb)) ? 0 : parseInt(numb);
                }
            });
            console.log("Number of images:", numberOfImg);
        }
        if(!title) title = "Temp";
        title = title.replace(/\\|\/|\:|\*|\?|\"|\<|\>|\||\~/g, "").substring(0, 150);
        if (!fs.existsSync(baseDir + `${title ? title + slash : ""}`)){
            fs.mkdirSync(baseDir + `${title ? title + slash : ""}`, { recursive: true });
        }
        if(page) {
            let src = document.querySelector("#image-container img")?.getAttribute("src");
            if(src) {
                console.log(`${page}: ${src}`);
                downloadImage(src, baseDir + `${title ? title + slash : ""}${page.toString().padStart(numberOfImg.toString().length, '0')}.${src.split(".").pop(-1)}`);
            }
            await getData(page + 1);
        }
        else {
            await getData(1);
        }
    }
    catch (err) {
        await getData(page);
    }
}

function downloadImage(url, filepath, retry = 1) {
    const file = fs.createWriteStream(filepath);
    https.get(url, function (response) {
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

function downloadImageLazy(url, filepath, retry = 1) {
    return new Promise(resolve => {
        const file = fs.createWriteStream(filepath);
        https.get(url, function (response) {
            response.pipe(file);

            if(response.statusCode == 200) {
                file.on("finish", () => {
                    console.log(`Finish ${filepath}`)
                    file.close();
                    resolve();
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
    });
}