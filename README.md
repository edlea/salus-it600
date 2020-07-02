# Client for Salus iT600

A JavaScript package to communicate with Salus internet connected thermostats.

## Installation

```bash
npm install salus-it600
```

## Usage

Salus authentication requires a username and password. This is exchanged for a short-lived security token. There is no way to refesh the tokens, so unfortunately we need to keep the username and password in memory.

All request methods are promise-based.

```js
const Salus = require("salus-it600");
const salus = new Salus({ username: "example@email.com", password: "secret" });

salus.devices().then(console.log);
```

## Limitations

This library is provided "as-is" with limited testing. Currently only thermostats connected to under-floor heating, using centigrade (i.e. not fahrenheit) have been tested.

## Methods

### devices

List all thermostats associated with the account.

```js
await salus.devices();
```

#### Return

```js
{
    id: 'a0b1',
    name: 'Given Room Name',
    current: 18,
    target: 21,
    mode: 'AUTO_HIGH',
    heating: true
}
```

### setTarget

Set the target temperature for a thermostat. Requires the `id` of the thermostat to modify, from `devices`.

```js
await salus.setTarget({ id: "a0b1", temperature: 18 });
```

The return value from the API is always 0, even if the command is unsuccessful.

### setMode

Sets the operating mode for the thermostat. Requires the `id` of the thermostat to modify, from `devices`.

```js
await salus.setMode({ id: "a0b1", mode: "PARTY" });
```

The return value from the API is always 0, even if the command is unsuccessful.

## Modes

Thermostats can be set to the following modes:

- `AUTO_HIGH`
- `AUTO_MEDIUM`
- `AUTO_LOW`
- `HIGH`
- `MEDIUM`
- `LOW`
- `PARTY`
- `AWAY`
- `FROST`

Thermostats will be in one of the above modes, or return one of these additional modes:

- `OFFLINE`
- `ON`
- `UNDEFINED`
