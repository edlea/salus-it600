"use strict";

const md5 = require("md5");
const xml = require("fast-xml-parser");
const bent = require("bent");
const get = bent(
  "https://emea-salprod02-api.arrayent.com:8081/zdk/services/zamapi/",
  "string"
);

const APPID = "1097";
const ATTRIBUTES = {
  NAME: 2287,
  SUMMARY: 2257,
};
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
  "ON",
  "UNDEFINED",
  "UNDEFINED",
  "UNDEFINED",
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
  current: (summary.charCodeAt(2) - 32) * 0.5,
  target: (summary.charCodeAt(3) - 32) * 0.5,
  mode: MODES[summary.charCodeAt(1) - 32],
  heating: summary.charCodeAt(1) - 32 > 9,
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

  _baseParameters() {
    return `secToken=${this.session.securityToken}&userId=${
      this.session.userId
    }&devId=${this.device.devId}&timestamp=${new Date().getTime()}`;
  }

  async _request({ method, parameters, _retry = false }) {
    if (!this.session) await this.login();
    const request = `${method}?${this._baseParameters()}&${parameters}`;
    try {
      const response = await get(request);
      return xml.parse(response, {
        ignoreNameSpace: true,
      });
    } catch (e) {
      // Do it again, once to avoid an infinite loop
      if (e.statusCode == 500 && _retry == false) {
        await this.login();
        return await this._request({
          method,
          parameters,
          _retry: true,
        });
      }
    }
  }

  async devices() {
    const response = await this._request({
      method: "getDeviceAttributesWithValues",
      parameters: `deviceTypeId=1`,
    });
    const deviceAttributes =
      response.getDeviceAttributesWithValuesResponse.attrList;
    const namesAttribute = deviceAttributes.find(
      (attribute) => attribute.id == ATTRIBUTES["NAME"]
    );
    const summary = deviceAttributes
      .find((attribute) => attribute.id == ATTRIBUTES["SUMMARY"])
      .value.match(/.{1,8}/g)
      .map((a) => ({
        id: a.substring(0, 4),
        value: a.substring(4),
      }));

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
    if (!id || !temperature)
      throw new Error("Both id and temperature named arguments must be set");
    const value = `!${id}${String.fromCharCode(temperature * 2 + 32)}`;
    console.log(value);
    const result = await this._request({
      method: "setMultiDeviceAttributes2",
      parameters: `name1=B06&value1=${encodeURIComponent(value)}`,
    });
    return result;
  }

  async setMode({ id, mode, duration }) {
    const MODES = ["AUTO", "HIGH", "MEDIUM", "LOW", "PARTY", "AWAY", "FROST"];
    if (!id || !mode)
      throw new Error("Both id and mode named arguments must be set");
    if (!MODES.includes(mode)) throw new Error(`Unknown mode: ${mode}`);
    /*
            35 - # - AUTO
            36 - $ - HIGH
            37 - % - MEDIUM
            38 - & - LOW
            39 - ' - PARTY (followed by zeropadded number of hours)
            40 - ( - AWAY (followed by zeropadded number of days)
            41 - ) - FROST
          */
    const value = `!${id}${String.fromCharCode(MODES.indexOf(mode) + 35)}${
      duration ? duration.toString().padStart(2, "0") : ""
    }`;
    console.log(value);
    const result = await this._request({
      method: "setMultiDeviceAttributes2",
      parameters: `name1=B05&value1=${encodeURIComponent(value)}`,
    });
    return result;
  }
}

module.exports = Salus;
