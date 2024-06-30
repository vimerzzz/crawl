const fs = require("fs");
const axios = require("axios");
const jsdom = require("jsdom");
const https = require("https");
const readline = require("readline-sync");

let baseDir = "";
let link = "";
let pages = [];
let videos = [];
let slash = "\\";
let defaultTitle = "Rule34 Video ";
let title = "";
let domain = "";

getData(0);

async function getData(pid) {
    try {
        if(!pid) {
            let _baseDir = readline.question("Base Directory: ");
            let _originLink = readline.question("Rule34 Link (for video): ");
            _baseDir = _baseDir.replaceAll("/", slash);
            _baseDir = _baseDir.replaceAll("\\", slash);
            if(!_baseDir.endsWith(slash)) _baseDir += slash;
            baseDir = _baseDir;
            link = _originLink;
            if(link) {
                domain = new URL(link).origin;
                if(domain?.endsWith("/")) {
                    domain = domain.substring(0, domain.length - 1);
                }
            }
        }
        if(!baseDir) {
            console.log("No base directory!");
            return;
        }
        if(!link || !domain) {
            console.log("No link!");
            return;
        }
        let query = new URLSearchParams(link.substring(link.indexOf("?")));
        let post = query.get("page");
        let view = query.get("s");
        if(post === "post" && view === "list") {
            title = defaultTitle + query.get("tags");
            let _l = `${link}&pid=${pid}`;
            let document = (await jsdom.JSDOM.fromURL(_l)).window.document;
            let imgList = document.querySelectorAll(".image-list a");
            if(!imgList.length) getVideo();
            else {
                console.log(`Getting links from ${_l}`);
                imgList.forEach(i => {
                    let href = i.getAttribute("href") ?? "";
                    if(!href.startsWith("/") && !href.startsWith("http")) href = "/" + href;
                    if(href.indexOf(domain) < 0) href = domain + href;
                    pages.push(href);
                });
                pid += imgList.length;
                getData(pid);
            }
        }
        else if(post === "post" && view === "view") {
            let id = query.get("id");
            id ??= "TEMP";
            title = defaultTitle + id;
            if (!fs.existsSync(baseDir + `${title ? title + slash : ""}`)){
                fs.mkdirSync(baseDir + `${title ? title + slash : ""}`, { recursive: true });
            }
            let document = (await jsdom.JSDOM.fromURL(link)).window.document;
            document.querySelectorAll("video source").forEach(q => {
                videos.push(q.getAttribute("src"));
            });
            let idx = 1;
            for(let video of videos) {
                let tail = video.split(".").pop(-1);
                if(id === "TEMP") {
                    id += `-${idx}`;
                    idx++;
                }
                tail = tail.substring(0, tail.indexOf("?") >= 0 ? tail.indexOf("?") : tail.length);
                await downloadVideo(video, baseDir + `${title ? title + slash : ""}${id}.${tail}`);
            }
        }
    }
    catch (err) {
        getData(pid);
    }
}

async function getVideo() {
    if (!fs.existsSync(baseDir + `${title ? title + slash : ""}`)){
        fs.mkdirSync(baseDir + `${title ? title + slash : ""}`, { recursive: true });
    }
    for (let index = 0; index < pages.length; index++) {
        let retry = true;
        while(retry) {
            try {
                let document = (await jsdom.JSDOM.fromURL(pages[index])).window.document;
                document.querySelectorAll("video source").forEach(q => {
                    let src = q.getAttribute("src");
                    console.log(`${index + 1}: ${src}`);
                    videos.push(src);
                });
                retry = false;
                if(index == pages.length - 1) {
                    let idx = 1;
                    for(let video of videos) {
                        let tail = video.split(".").pop(-1);
                        let id = `TEMP-${idx}`;
                        if(tail.indexOf("?") >= 0) {
                            id = tail.substring(tail.indexOf("?") + 1);
                            tail = tail.substring(0, tail.indexOf("?"));
                        }
                        else {
                            idx++;
                        }
                        await downloadVideo(video, baseDir + `${title ? title + slash : ""}${id}.${tail}`);
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


function downloadVideo(url, filepath, retry = 1) {
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