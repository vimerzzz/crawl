const fs = require("fs");
const axios = require("axios");
const jsdom = require("jsdom");
const https = require("https");
const readline = require("readline-sync");
const { exit } = require("process");

/* Set-Cookie value after logged in real browser, open your devTool before click the login button,
    at api 'https://forums.e-hentai.org/index.php?act=Login&CODE=01'
    and copy 2 values ipb_member_id, ipb_pass_hash at response header, Set-Cookie */
const userNameKey = "ipb_member_id";
const userName = "6254198";
const passwordKey = "ipb_pass_hash";
const password = "21d62d8fba90ef6cf24d53aadda8ef4f";

let baseDir = "";
let link = "";
let maxP = 0;
let pages = [];
let images = [];
let title = "";
let downloadNow = false;
let superLazy = false;
let fullImage = false;
let slash = "\\";
let startAt = 1;
let endAt = 2500;

getData(0);

async function getData(page) {
    try {
        if(!page) {
            let _baseDir = readline.question("Base Directory: ");
            let _originLink = readline.question("E-Hentai Link: ");
            downloadNow = readline.keyInYN("Do you want to download while getting the link?");
            superLazy = readline.keyInYN("Do you want to lazy download?");
            fullImage = readline.keyInYN("Do you want to download full size image?");
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
    let _end = pages.length < endAt ? pages.length : endAt;
    if(endAt < pages.length) {
        console.log(`Images will be not get from index ${endAt + 1} to ${pages.length}`)
    }
    for (let index = startAt - 1; index < _end; index++) {
        let retry = true;
        while(retry) {
            try {
                await new Promise((resolve) => setTimeout(resolve, 350));
                let data = await axios.get(pages[index]);
                let document = new jsdom.JSDOM(data.data).window.document;
                let src = document.getElementById("img")?.src;
                if(fullImage) {
                    let fullA = document.querySelectorAll("a");
                    let _ori = "";
                    for(let a of fullA) {
                        if(a.text?.includes("original") && a.href) {
                            _ori = a.href;
                            break;
                        }
                    }
                    if(_ori) {
                        src = _ori;
                    }
                }
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
                if(index == _end - 1) {
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
    axios.get(url, {
        headers: {
            cookie: fullImage ? `${userNameKey}=${userName}; ${passwordKey}=${password};` : "",
        },
        responseType: "stream",
    }).then((response) => {
        if(fullImage && response.headers["content-type"]?.includes("text/html")) {
            console.log("Please reset your userName and password in your code");
            exit();
        }
        else {
            const file = fs.createWriteStream(filepath);
            response.data.pipe(file);
            file.on("finish", () => {
                console.log(`Finish ${filepath}`)
                file.close();
            });
        }
    }).catch((error) => {
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
    return new Promise((resolve) => {
        axios.get(url, {
            headers: {
                cookie: fullImage ? `${userNameKey}=${userName}; ${passwordKey}=${password};` : "",
            },
            responseType: "stream",
        }).then((response) => {
            if(fullImage && response.headers["content-type"]?.includes("text/html")) {
                console.log("Please reset your userName and password in your code");
                exit();
            }
            else {
                const file = fs.createWriteStream(filepath);
                response.data.pipe(file);
                file.on("finish", () => {
                    console.log(`Finish ${filepath}`)
                    file.close();
                    resolve();
                });
            }
        }).catch((error) => {
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