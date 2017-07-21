/**
 * blear.node.system
 * @author ydr.me
 * @create 2016年06月04日14:09:36
 */




'use strict';

var os = require('os');
var plan = require('blear.utils.plan');
var collection = require('blear.utils.collection');
var request = require('blear.node.request');
var access = require('blear.utils.access');
var typeis = require('blear.utils.typeis');
var object = require('blear.utils.object');


var osReleaseMap = require('./_os-release.json');
var winReleaseMap = require('./_win-release.json');


var IP_138 = 'http://1111.ip138.com/ic.asp';
var IP_T086 = 'http://ip.t086.com/getip.php';
var IP_QQ = 'http://ip.qq.com/';
var IP_TAOBAO = 'http://ip.taobao.com/service/getIpInfo2.php';
var IP_LOOKUP = 'http://int.dpool.sina.com.cn/iplookup/iplookup.php';
var REG_IP = /\d{1,3}(\.\d{1,3}){3}/;
//Grab first CPU Measure
var startMeasure = cpuAverage();


/**
 * 获取本机局域网 IP 地址
 * @returns {*|string}
 */
exports.localIP = function () {
    var scopeIP = null;
    //console.log(os.networkInterfaces());
    collection.each(os.networkInterfaces(), function (networkType, networkList) {
        //{ address: 'fe80::1',
        //netmask: 'ffff:ffff:ffff:ffff::',
        //family: 'IPv6',
        //mac: '00:00:00:00:00:00',
        //scopeid: 1,
        //internal: true }
        collection.each(networkList, function (index, networkMeta) {
            if (networkMeta.family === 'IPv4' && networkMeta.internal === false) {
                scopeIP = networkMeta.address;
                return false;
            }
        });

        if (scopeIP) {
            return false;
        }
    });

    return scopeIP || 'localhost';
};


/**
 * 获取本机的广域网 IP 地址
 * @param [req] {Object} 请求对象
 * @param callback {Function} 回调
 */
exports.remoteIP = function (req, callback) {
    var args = access.args(arguments);

    if (args.length === 1) {
        callback = args[0];
        req = {};
    }

    req.headers = req.headers || {};
    var header = req.headers['x-real-ip'] ||
        req.headers['x-forwarded-for'] ||
        req.headers['remote-ip'] ||
        req.headers['remoteip'] || '';
    var matches = header.match(REG_IP);

    if (matches) {
        return callback(matches[0].split(',').pop().trim());
    }

    plan
    // 从 IP_TAOBAO 处获取
        .task(function (done) {
            request({
                url: IP_TAOBAO,
                query: {
                    ip: 'myip'
                }
            }, function (err, body) {
                if (err) {
                    return done(err);
                }

                var json = {};

                try {
                    json = JSON.parse(body);
                } catch (err) {
                    // ignore
                }

                done(null, json.data && json.data.ip);
            });
        })

        .serial(function (err, ip) {
            callback(ip || '127.0.0.1');
        });
};


/**
 * 获取操作系统信息，因为操作系统信息可变的，因此是一个函数
 * @returns {{cpus:Number, hostname:String, platform:String, release:String, alias:String, name: string, arch:String, username: String, language:String, node:string, isUnknow: boolean, isMac: boolean, isWindows: boolean, isLinux: boolean}}
 */
exports.os = function () {
    // 0=unknow,1=mac,2=windows,3=linux
    var osType = parseOSType();
    var osAlias = parseOSAlias();
    return {
        cpus: os.cpus().length,
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        alias: osAlias,
        name: ['unknow', 'mac', 'windows', 'linux'][osType],
        arch: os.arch(),
        username: process.env.LOGNAME || process.env.USER || 'unkown',
        language: getOSlanguage(),
        node: process.version.replace(/^v/i, '').trim(),
        isUnknow: osType === 0,
        isMac: osType === 1,
        isWindows: osType === 2,
        isLinux: osType === 3
    };
};


/**
 * 解析 IP 信息
 * @param [ip]
 * @param callback
 */
exports.parseIP = function (ip, callback) {
    plan
        .task(function (next) {
            request({
                url: IP_TAOBAO,
                query: {
                    ip: ip
                }
            }, function (err, body) {
                var ret = {};

                try {
                    ret = JSON.parse(body);
                } catch (err) {
                    // ignore
                }

                if (!typeis.Object(ret)) {
                    ret = {};
                }

                ret = ret.data || {};

                next(null, {
                    area: ret.area || '未知',
                    country: ret.country || '未知',
                    province: ret.region || '未知',
                    city: ret.city || '未知',
                    isp: ret.isp || '未知',
                    ip: ip
                });
            });
        })
        .serial(function (err, info) {
            callback(info);
        });
};


/**
 * CPU 占用率
 * @returns {number}
 */
exports.cpuUsage = function () {
    //Grab second Measure
    var endMeasure = cpuAverage();

    //Calculate the difference in idle and total time between the measures
    var idleDifference = endMeasure.idle - startMeasure.idle;
    var totalDifference = endMeasure.total - startMeasure.total;

    //Calculate the average percentage CPU usage
    return 1 - idleDifference / totalDifference;
};


/**
 * 内存占用率
 * @returns {Number}
 */
exports.memoryUsage = function () {
    return process.memoryUsage().rss;
};


/**
 * 解析系统类型
 */
function parseOSType() {
    switch (os.platform()) {
        case 'darwin':
            return 1;

        case 'win32':
        case 'win64':
        case 'win':
            return 2;

        case 'linux':
            return 3;
    }

    return 0;
}

/**
 * 解析系统名称
 */
function parseOSAlias() {
    var release = os.release();
    switch (os.platform()) {
        case 'darwin':
            return parseDarwinRelease(release);

        case 'win32':
        case 'win64':
        case 'win':
            return parseWin32Release(release);

        case 'linux':
            return 'Linux ' + release.match(/^(\d+\.\d+).*/)[1];
    }

    return 'unknow';
}


/**
 * 解析达尔文
 * @param release
 * @ref https://github.com/sindresorhus/osx-release
 * @returns {*}
 */
function parseDarwinRelease(release) {
    release = release.split('.')[0];

    if (osReleaseMap[release]) {
        return 'OS X ' + osReleaseMap[release];
    }

    return 'unknow';
}


/**
 * 解析 win32
 * @param release
 * @ref https://github.com/sindresorhus/win-release
 * @returns {*}
 */
function parseWin32Release(release) {
    release = release.split('.')[0];

    if (winReleaseMap[release]) {
        return 'Windows ' + osReleaseMap[release];
    }

    return 'unknow';
}


/**
 * 获取系统语言
 * @ref https://github.com/sindresorhus/os-locale
 * @returns {*}
 */
function getOSlanguage() {
    var env = process.env;
    var locale = env.LANG || env.LANGUAGE || env.LC_ALL || env.LC_MESSAGES || env.LC_CTYPE;

    return locale || 'EN:UTF-8';
}


//Create function to get CPU information
function cpuAverage() {

    //Initialise sum of idle and time of cores and fetch CPU info
    var totalIdle = 0, totalTick = 0;
    var cpus = os.cpus();

    //Loop through CPU cores
    for (var i = 0, len = cpus.length; i < len; i++) {

        //Select CPU core
        var cpu = cpus[i];

        //Total up the time in the cores tick
        object.each(cpu.times, function (key, val) {
            totalTick += val;
        });

        //Total up the idle time of the core
        totalIdle += cpu.times.idle;
    }

    //Return the average Idle and Tick times
    return {idle: totalIdle / cpus.length, total: totalTick / cpus.length};
}

