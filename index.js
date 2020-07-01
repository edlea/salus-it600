"use strict";

const md5 = require("md5");
const xml = require("fast-xml-parser");
const bent = require("bent");
const get = bent(
  "https://emea-salprod02-api.arrayent.com:8081/zdk/services/zamapi/",
  "string"
);

const APPID = "1097";
const ATTRIBUTES = { NAME: 2287, SUMMARY: 2257 };
const MODES = [
  "OFFLINE",
  "AUTO_HIGH",
  "AUTO_MEDIUM",
  "AUTO_LOW",
  "HIGH",
  "MEDIUM",
  "LOW",
  "PARTY",
  "AWAY",
  "FROST",
  "ON",
];

const summaryToValues = (summary) => ({
  target: (summary.charCodeAt(2) - 32) * 0.5,
  current: (summary.charCodeAt(3) - 32) * 0.5,
  mode: MODES[summary.charCodeAt(1) - 32],
});

class Salus {
  constructor({ username, password }) {
    this.username = username;
    this.password = password;
  }

  async login() {
    const loginResponse = await get(
      `userLogin?appId=${APPID}&name=${this.username}&password=${md5(
        this.password
      )}&timestamp=${new Date().getTime()}`
    );
    const userLoginResponse = xml.parse(loginResponse, {
      ignoreNameSpace: true,
    });
    this.session = userLoginResponse.userLoginResponse;

    const devicesResponse = await get(
      `getDeviceList?secToken=${this.session.securityToken}&userId=${
        this.session.userId
      }&timestamp=${new Date().getTime()}`
    );
    this.device = xml.parse(devicesResponse, {
      ignoreNameSpace: true,
    }).getDeviceListResponse.devList;
  }

  baseParameters() {
    return `secToken=${this.session.securityToken}&userId=${
      this.session.userId
    }&timestamp=${new Date().getTime()}`;
  }

  async devices() {
    if (!this.session) await this.login();
    const response = await get(
      `getDeviceAttributesWithValues?${this.baseParameters()}&deviceTypeId=1&devId=${
        this.device.devId
      }`
    );
    const deviceAttributes = xml.parse(response, { ignoreNameSpace: true })
      .getDeviceAttributesWithValuesResponse.attrList;

    const namesAttribute = deviceAttributes.find(
      (attribute) => attribute.id == ATTRIBUTES["NAME"]
    );
    const summary = deviceAttributes
      .find((attribute) => attribute.id == ATTRIBUTES["SUMMARY"])
      .value.match(/.{1,8}/g)
      .map((a) => ({ id: a.substring(0, 4), value: a.substring(4) }));

    const devices = namesAttribute.value
      .replace(/,$/, "")
      .split(",")
      .map((n) => ({
        id: n.substring(0, 4),
        name: n.substring(4),
        ...summaryToValues(
          summary.find((s) => s.id == n.substring(0, 4)).value
        ),
      }));
    return devices;
  }

  async setTarget({ id, temperature }) {
    if (!this.session) await this.login();
    const value = `!${id}${String.fromCharCode(temperature * 2 + 32)}`;
    console.log(`value: ${value} encoded: ${encodeURIComponent(value)}`);
    const result = await get(
      `setMultiDeviceAttributes2?${this.baseParameters()}&devId=${
        this.device.devId
      }&name1=B06&value1=${encodeURIComponent(value)}`
    );
    return result;
  }

  async setMode({ id, mode, duration }) {
    if (!this.session) await this.login();
    /*
        35 - # - AUTO
        36 - $ - HIGH
        37 - % - MEDIUM
        38 - & - LOW
        39 - ' - PARTY (followed by zeropadded number of hours)
        40 - ( - AWAY (followed by zeropadded number of days)
        41 - ) - FROST
      */
    const MODES = ["AUTO", "HIGH", "MEDIUM", "LOW", "PARTY", "AWAY", "FROST"];
    const value = `!${id}${String.fromCharCode(MODES.indexOf(mode) + 35)}${
      duration ? duration.toString().padStart(2, "0") : ""
    }`;
    console.log(`value: ${value} encoded: ${encodeURIComponent(value)}`);
    const result = await get(
      `setMultiDeviceAttributes2?${this.baseParameters()}&devId=${
        this.device.devId
      }&name1=B05&value1=${encodeURIComponent(value)}`
    );
    return result;
  }
}

module.exports = Salus;
