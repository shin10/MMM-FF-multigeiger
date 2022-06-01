![Magic Mirror² displaying a radiation graph of a multigeiger](screenshot.png)

# MMM-FF-multigeiger

[![ISC License](https://img.shields.io/badge/license-ISC-blue.svg)](https://choosealicense.com/licenses/isc)

A module for [MagicMirror²](https://github.com/MichMich/MagicMirror) showing radiation charts from[https://multigeiger.citysensor.de](https://multigeiger.citysensor.de/).

Features:

- sequences
- events for user interactions
- supports multiple module instances
- supports multiple mirror instances, controlled by a single server

## Installation

Navigate to the `modules` directory of your MagicMirror² installation and clone this repository.

```sh
git clone https://github.com/shin10/MMM-FF-multigeiger.git
$(
  cd MMM-FF-multigeiger &&
  npm i
)
```

## Configuration

**Example:**

```js
{
  module: "MMM-FF-multigeiger",
  position: "bottom_bar",
  header: "Multigeiger Deutschland",
  classes: "multigeiger-list-2",
  hiddenOnStartup: true,
  disabled: false,
  config: {
    layout: "list-horizontal",
    sensorList: [
      {
        description: "Current Radiation",
        weight: 1,
        type: "current",
        layout: "list-horizontal",
        toggleUnitInterval: 10000,
        sensors: [
          { id: 31122, description: "Stuttgart" },
          { id: 59328, description: "Bern" },
          { id: 70948, description: "Nürnberg" },
          { id: 65059, description: "Hamburg" },
          { id: 45879, description: "Dresden" },
        ],
      },
      {
        description: "Current Radiation",
        weight: 1,
        type: "current",
        layout: "list-horizontal",
        toggleUnitInterval: 4000,
        sensors: [
          { id: 71364, description: "Utrecht" },
          { id: 71180, description: "Leipzig" },
          { id: 70784, description: "Zürich" },
          { id: 72366, description: "Augsburg" },
        ],
      },
    ],
  },
},
```

### Configuration Options

| **Option**           | **Type**         | **Default**                            | **Description**                                                                                                                                                                 |
| -------------------- | ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header`             | `string`         | `"Multigeiger"`                        | Basically that. Doesn't have to be changed unless you're self-hosting.                                                                                                          |
| `baseURL`            | `string`         | `"https://multigeiger.citysensor.de/"` | Basically that. Doesn't have to be changed unless you're self-hosting.                                                                                                          |
| `sheets`             | `Array<sheet>`   |                                        | The list of cheat sheets to rotate through.                                                                                                                                     |
| `style`              | `string`         | `"default"`                            | Your favorite color theme. You can provide a string                                                                                                                             |
| `sequence`           | `string`         | `"default"`                            | The direction to loop through the urls list. `null`/`default`, `reverse`, `random`. The `weight` property of an url item will only be respected if sequence is set to `random`. |
| `updateInterval`     | `int`            | `600000` (10 minutes)                  | The duration of the update interval in ms or `null`.                                                                                                                            |
| `updateOnSuspension` | `bool`           | `null`                                 | `null`, `false` or `true`. Further explanations below.                                                                                                                          |
| `showTitle`          | `bool`           | `true`                                 | A boolean to show/hide the title.                                                                                                                                               |
| `loadingCursor`      | `string`         | `"&nbsp;&block;"`                      | The Text cursor indicating that the module is loading a cheat sheet. Default is `&nbsp;&block;` but could be any string.                                                        |
| `animationSpeed`     | `int`            | `1000`                                 | The duration of the page transition.                                                                                                                                            |
| `events`             | `object`         |                                        | An object listing event constants to remap if necessary.                                                                                                                        |
| `events.sender`      | `string`/`array` | `null`                                 | If this is set, only events sent by the modules with this id will be processed.                                                                                                 |

### Sheet list items

The items in the sheet list need a path. All other properties are optional. The `weight` property will be used if the `SENSOR_LIST_ITEM_RANDOM` event is dispatched, or sequence is set to `random`. Options and styles can be set to override the defaults for single items.

```js
{
  path: ":random",
  options: "qTcCQ",
  style: "lovelace",
  weight: 10
}
```

### `updateInterval` and `updateOnSuspension`

These two parameters work together. The `updateInterval` is used to set the **_minimal_** amount of time the displayed item has to exist, before it will be replaced by the next. When this actually will take place depends on the value of `updateOnSuspension`.

If `updateOnSuspension` is set to `true` the item will wait till the interval timer fired and the module goes to the background. If set to `false` the `updateInterval` has to elapse while the item is in background and will replace the item when the module is shown again.

If `updateOnSuspension` is set to `null` the content will be replaced whenever the timer is done; visible or not.

If `updateInterval` is set to `null` the item won't be updated by the module. Instead you'll have to dispatch one of the events listed above.

### Events

The following events are supported:

- SENSOR_LIST_ITEM_PREVIOUS
- SENSOR_LIST_ITEM_NEXT
- SENSOR_LIST_ITEM_RANDOM

For ease of use they can be remapped in the `events` object to custom strings. Refer to the example config above.

Events will be ignored if the module is currently hidden.

[&pi;](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
