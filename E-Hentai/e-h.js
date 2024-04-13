const fs = require("fs");
const axios = require("axios");
const jsdom = require("jsdom");
const https = require("https");
const readline = require("readline-sync");

let baseDir = "";
let link = "";
let maxP = 0;
let pages = [];
let images = [];
let title = "";
let downloadNow = false;
let superLazy = false;
let slash = "\\";

getData(0);

async function getData(page) {
    try {
        if(!page) {
            let _baseDir = readline.question("Base Directory: ");
            let _originLink = readline.question("E-Hentai Link: ");
            downloadNow = readline.keyInYN("Do you want to download while getting the link?");
            superLazy = readline.keyInYN("Do you want to lazy download?");
            if(!_baseDir.endsWith(slash)) _baseDir += slash;
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
        await new Promise((resolve) => setTimeout(resolve, 150));
        let _l = link + (page ? `?p=${page}` : "");
        console.log(`Getting links from ${_l}`);
        let data = await axios.get(_l);
        let document = new jsdom.JSDOM(data.data).window.document;
        title = document.title.replace(/\\|\/|\:|\*|\?|\"|\<|\>|\||\~/g, "").substring(0, 200);
        let as = document.querySelectorAll(".gdtm a");
        if(!page) {
            let ts = document.querySelectorAll("table.ptb a");
            let existedHref = [];
            for(let index = 0; index < ts.length; index++) {
                let href = ts[index].getAttribute("href");
                if(href.includes("?p=") && !existedHref.includes(href)) {
                    existedHref.push(href);
                }
                let _m = parseInt(href.split("?p=").pop(-1));
                if(!isNaN(_m)) {
                    maxP = maxP > _m ? maxP : _m;
                }
            }
        }
        for(let index = 0; index < as.length; index++) {
            let href = as[index].getAttribute("href");
            if(!pages.includes(href)) pages.push(href);
        }
        if(page < maxP) {
            getData(page + 1);
        }
        else {
            getImage();
        }
    }
    catch (err) {
        getData(page);
    }
}

async function getImage() {
    if (!fs.existsSync(baseDir + `${title ? title + slash : ""}`)){
        fs.mkdirSync(baseDir + `${title ? title + slash : ""}`, { recursive: true });
    }
    for (let index = 0; index < pages.length; index++) {
        let retry = true;
        while(retry) {
            try {
                await new Promise((resolve) => setTimeout(resolve, 350));
                let data = await axios.get(pages[index]);
                let document = new jsdom.JSDOM(data.data).window.document;
                let src = document.getElementById("img")?.src;
                if(src && !images.find(s => s.src == src)) {
                    console.log(`${index + 1}: ${src}`);
                    if(downloadNow) {
                        if(superLazy) {
                            await downloadImageLazy(src, baseDir + `${title ? title + slash : ""}${(index + 1).toString().padStart(pages.length.toString().length, '0')}.${src.split(".").pop(-1)}`);
                        }
                        else {
                            downloadImage(src, baseDir + `${title ? title + slash : ""}${(index + 1).toString().padStart(pages.length.toString().length, '0')}.${src.split(".").pop(-1)}`);
                        }
                    }
                    else {
                        images.push({
                            index: index + 1,
                            src: src
                        });
                    }
                }
                retry = false;
                if(index == pages.length - 1) {
                    if(superLazy) {
                        for(let image of images) {
                            await downloadImageLazy(image.src, baseDir + `${title ? title + slash : ""}${image.index.toString().padStart(pages.length.toString().length, '0')}.${image.src.split(".").pop(-1)}`);
                        }
                    }
                    else {
                        images.forEach(image => {
                            downloadImage(image.src, baseDir + `${title ? title + slash : ""}${image.index.toString().padStart(pages.length.toString().length, '0')}.${image.src.split(".").pop(-1)}`);
                        });
                    }
                }
            }
            catch(err) {
                console.log(err);
                retry = true;
            }
        }
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