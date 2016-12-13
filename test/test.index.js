/**
 * mocha 测试 文件
 * @author ydr.me
 * @create 2016-05-17 12:13
 */


'use strict';

var expect = require('chai').expect;
var system = require('../src/index.js');

describe('测试文件', function () {
    it('.localIP', function () {
        console.log(system.localIP());
    });

    it('.remoteIP', function (done) {
        system.remoteIP(function (ip) {
            console.log(ip);
            done();
        });
    });

    it('.os', function (done) {
        console.log(system.os());
        done();
    });

    it('.parseIP', function (done) {
        system.parseIP('39.181.65.196', function (info) {
            console.log(info);
            done();
        });
    });
});

