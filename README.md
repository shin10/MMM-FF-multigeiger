# MMM-FF-multigeiger

![MagicMirror² displaying a radiation graph of a multigeiger](screenshot.gif)

[![ISC License](https://img.shields.io/badge/license-ISC-blue.svg)](https://choosealicense.com/licenses/isc)

A module for [MagicMirror²](https://github.com/MichMich/MagicMirror) showing radiation charts from [https://multigeiger.citysensor.de](https://multigeiger.citysensor.de/).
Want to help us? [Join the project and build your own Geiger-Müller counter!](https://ecocurious.de/projekte/multigeiger-2/)

Features:

- shows multiple sensors collections
- multiple layouts
- date ranges for 24 hours, week and month
- shows min/max/average and current values
- toggles between CPM and µSv
- customizable colors
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
    style: "default",
    sequence: "default",
    updateOnSuspension: null,
    updateInterval: 5 * 60 * 1000,
    showTitle: true,
    animationSpeed: 1000,
    toggleUnitInterval: 10 * 1000,
    sensorList: [
      {
        description: "Current Radiation",
        weight: 1,
        type: "day",
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
        type: "day",
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
    events: {
      SENSOR_LIST_ITEM_RANDOM: "SENSOR_LIST_ITEM_RANDOM",
      SENSOR_LIST_ITEM_PREVIOUS: "SENSOR_LIST_ITEM_PREVIOUS",
      SENSOR_LIST_ITEM_NEXT: "SENSOR_LIST_ITEM_NEXT",

      SENSOR_LIST_DATE_BACKWARDS: "SENSOR_LIST_DATE_BACKWARDS",
      SENSOR_LIST_DATE_FORWARDS: "SENSOR_LIST_DATE_FORWARDS",
      SENSOR_LIST_DATE_NOW: "SENSOR_LIST_DATE_NOW",
      SENSOR_LIST_DATE_RANGE_ZOOM_IN: "SENSOR_LIST_DATE_RANGE_ZOOM_IN",
      SENSOR_LIST_DATE_RANGE_ZOOM_OUT: "SENSOR_LIST_DATE_RANGE_ZOOM_OUT",

      SENSOR_LIST_LAYOUT_PREVIOUS: "SENSOR_LIST_LAYOUT_PREVIOUS",
      SENSOR_LIST_LAYOUT_NEXT: "SENSOR_LIST_LAYOUT_NEXT"
    }
  },
},
```

### Configuration Options

#### General

| **Option**           | **Type**         | **Default**                            | **Description**                                                                                                                                        |
| -------------------- | ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `baseURL`            | `string`         | `"https://multigeiger.citysensor.de/"` | Basically that. Doesn't have to be changed.                                                                                                            |
| `header`             | `string`         | `"Multigeiger"`                        | The module title.                                                                                                                                      |
| `showTitle`          | `bool`           | `true`                                 | A boolean to show/hide the title.                                                                                                                      |
| `sequence`           | `string`         | `default`                              | The order in which to loop through the items in the sensorList: `default`, `random` or `reverse`                                                       |
| `updateInterval`     | `int`            | `900000` (15 minutes)                  | The duration of the update interval in ms or `null`.                                                                                                   |
| `updateOnSuspension` | `bool`           | `null`                                 | `null`, `false` or `true`. Further explanations below.                                                                                                 |
| `animationSpeed`     | `int`            | `1000`                                 | The duration of the page transition.                                                                                                                   |
| `layout`             | `string`         | `list-horizontal`                      | Defines the layout as either `list-horizontal`, `list-vertical` or `charts`.                                                                           |
| `type`               | `string`         | `day`                                  | Set's the amount of data shown to `day`, `week` or `month`.                                                                                            |
| `avgTime`            | `int`            | `60`                                   | The amount of minutes for smoothing the radiation values.                                                                                              |
| `chartColors`        | `string`/`array` | `default`                              | Color of the line charts: `default` (gradient), a single color string (`"#fff"`) or an array of color strings (`["#f00", "#0f0", "#00f"]`) for charts. |
| `toggleUnitInterval` | `int`            | `10000` (10 seconds)                   | The amount of time showing values in CPM/µSv units before switching.                                                                                   |
| `sensorList`         | `array`          | SensorListItem[]                       | An array with sensorList configurations.                                                                                                               |
| `events`             | `object`         |                                        | An object listing event constants to remap if necessary.                                                                                               |
| `events.sender`      | `string`/`array` | `null`                                 | If this is set, only events sent by the modules with this `name` or `id` will be processed.                                                            |

#### SensorListItems

_\*) optional_

| **Option**             | **Type**         | **Default** | **Description**                                                       |
| ---------------------- | ---------------- | ----------- | --------------------------------------------------------------------- |
| `sensors`              | Sensor[]         | `undefined` | An array of objects with sensor `id` and `description` shown as list. |
| `weight`\*             | `float`          | `1.0`       | A number to set the probability for random mode.                      |
| `header`\*             | `string`         | `undefined` | Overrides the general `header`.                                       |
| `showTitle`\*          | `bool`           | `undefined` | Overrides the general `showTitle`.                                    |
| `layout`\*             | `string`         | `undefined` | Overrides the general `layout`.                                       |
| `type`\*               | `string`         | `undefined` | Overrides the general `type`.                                         |
| `avgTime`\*            | `int`            | `undefined` | Overrides the general `avgTime`.                                      |
| `longAVG`\*            | `int`            | `undefined` | Overrides the general `longAVG`.                                      |
| `chartColors`\*        | `string`/`array` | `undefined` | Overrides the general `chartColors`.                                  |
| `toggleUnitInterval`\* | `int`            | `undefined` | Overrides the general `toggleUnitInterval`.                           |

#### Sensor

| **Option**    | **Type** | **Description**                                              |
| ------------- | -------- | ------------------------------------------------------------ |
| `id`          | `int`    | The sensors `id` given at https://multigeiger.citysensor.de/ |
| `description` | `string` | The display name of the sensor.                              |

### Layouts (`layoutType`)

#### `charts`

A multi line chart for a list of sensors.

![MagicMirror² displaying a multi line graph with radiation data of multigeiger devices](screenshot-charts.gif)

#### `list-horizontal`/`list-vertical`

Shows a list of sensors with (cropped) graphs related to each other.

![MagicMirror² displaying a radiation graph of a multigeiger](screenshot.gif)

### Sensor list items

The items in the sensor list define the collection of sensors. Further you can override the general config properties per sensorList item to switch `layout` or data amount (`type`).

The `weight` property will be used if the `SENSOR_LIST_ITEM_RANDOM` event is dispatched, or sequence is set to `random`.

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

- SENSOR_LIST_DATE_BACKWARDS
- SENSOR_LIST_DATE_FORWARDS
- SENSOR_LIST_DATE_NOW
- SENSOR_LIST_DATE_RANGE_ZOOM_IN
- SENSOR_LIST_DATE_RANGE_ZOOM_OUT

- SENSOR_LIST_LAYOUT_PREVIOUS
- SENSOR_LIST_LAYOUT_NEXT

For ease of use they can be remapped in the `events` object to custom strings. Further you can add an array of `sender`s for filtering the dispatching modules.

```js
    events: {
      sender: ["MMM-Touch", "MMM-GroveGestures"],
      ARTICLE_RANDOM: "SENSOR_LIST_ITEM_RANDOM",
      ARTICLE_PREVIOUS: "SENSOR_LIST_ITEM_PREVIOUS",
      ARTICLE_NEXT: "SENSOR_LIST_ITEM_NEXT",
      // ...
    }
```

Events will be ignored if the module is currently hidden.

[&pi;](https://www.youtube.com/watch?v=lQ1U3beoXAc)
