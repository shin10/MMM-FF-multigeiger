/* Magic Mirror
 * Module: MMM-FF-multigeiger
 *
 * By Michael Trenkler
 * ISC Licensed.
 */

Module.register("MMM-FF-multigeiger", {
  defaults: {
    header: "Multigeiger",
    baseURL: "https://multigeiger.citysensor.de/",
    sensorList: [
      {
        description: "Current Radiation",
        weight: 1,
        type: "current", // list
        layout: "list-horizontal",
        sensors: [
          { id: 71364, description: "Utrecht" },
          { id: 71180, description: "Leipzig" },
          { id: 70784, description: "Zürich" },
          { id: 72366, description: "Augsburg" }
        ]
      },
      {
        description: "Current Radiation",
        weight: 1,
        type: "current",
        layout: "list-horizontal",
        sensors: [
          { id: 31122, description: "Stuttgart" },
          { id: 59328, description: "Bern" },
          { id: 70948, description: "Nürnberg" },
          { id: 65059, description: "Hamburg" }
        ]
      }
    ],
    layout: "list-horizontal",
    // style: "default", // or "monochrome", "color", ["#f00", "#0f0", "#00f" ...]
    sequence: "default", // null, 'random', 'default', 'reverse'
    updateOnSuspension: null, // null, false or true
    updateInterval: 5 * 60 * 1000, // 5 minutes
    showTitle: true,
    animationSpeed: 1000,
    toggleUnitInterval: 10 * 1000,
    events: {
      SENSOR_LIST_ITEM_PREVIOUS: "SENSOR_LIST_ITEM_PREVIOUS",
      SENSOR_LIST_ITEM_NEXT: "SENSOR_LIST_ITEM_NEXT",
      SENSOR_LIST_ITEM_RANDOM: "SENSOR_LIST_ITEM_RANDOM"
    }
  },

  init: function () {
    this.errors = null;
    this.sensorListConfig = null;
    this.avgs = null;
    this.avgsFiltered = null;
    this.sensorProperties = null;
    this.errors = [];
    this.toggleUnitInterval = null;
    this.toggleUnitIntervalState = false;
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    this.config.moduleId = this.identifier;
    this.sendSocketNotification("GET_INITIAL_SENSOR_DATA", {
      config: this.config
    });
  },

  getScripts: function () {
    return [this.file("node_modules/d3/dist/d3.js")];
  },

  getStyles: function () {
    return [this.file("./styles/MMM-FF-multigeiger.css")];
  },

  getHeader: function () {
    if (!this.config.showTitle) return null;
    if (!this.avgs) return this.config.header;
    return `${this.config.header} ${this.translate(
      this.sensorListConfig?.type
    )}`;
  },

  getTemplate(layout) {
    layout = layout || this.sensorListConfig?.layout;

    if (this.errors?.length) {
      layout = "error";
    }

    if (!layout) return "templates/list-horizontal.njk";
    return `templates/${layout}.njk`;
  },

  getTemplateData() {
    let dataComplete = true;

    const sensors = this.sensorListConfig?.sensors?.map((sensor) => {
      // preserve config order
      sensor.avg = this.avgsFiltered?.filter((_) => sensor.id === _.id)[0];
      sensor.properties = this.sensorProperties[sensor.id];
      dataComplete = dataComplete && sensor.avg && sensor.properties;

      sensor.chartData = {
        day: this.chartData.day[sensor.id],
        week: this.chartData.week[sensor.id],
        month: this.chartData.month[sensor.id]
      };
      sensor.minVals = this.minVals[sensor.id];
      sensor.maxVals = this.maxVals[sensor.id];
      sensor.avg48Vals = this.avg48Vals[sensor.id];
      sensor.latestVals = this.latestVals[sensor.id];

      return sensor;
    });
    dataComplete = dataComplete && sensors?.length;

    return {
      sensorListConfig: this.sensorListConfig,
      sensors,
      dataComplete,
      errors: this.errors
    };
  },

  getTranslations() {
    return {
      de: "translations/de.json",
      en: "translations/en.json"
    };
  },

  toggleUnitIntervalFunction() {
    if (this.toggleUnitInterval) clearTimeout(this.toggleUnitInterval);

    this.toggleUnitInterval = setTimeout(() => {
      this.toggleUnitIntervalState = !this.toggleUnitIntervalState;
      [
        ...document
          .getElementById(this.identifier)
          .getElementsByClassName("sensorlist-current-cpm")
      ].forEach((_) => _.classList.remove("show", "hide"));
      [
        ...document
          .getElementById(this.identifier)
          .getElementsByClassName("sensorlist-current-svt")
      ].forEach((_) => _.classList.remove("show", "hide"));
      window.requestAnimationFrame(() => {
        [
          ...document
            .getElementById(this.identifier)
            .getElementsByClassName("sensorlist-current-cpm")
        ].forEach((_) => {
          _.classList.add(!this.toggleUnitIntervalState ? "show" : "hide");
        });
        [
          ...document
            .getElementById(this.identifier)
            .getElementsByClassName("sensorlist-current-svt")
        ].forEach((_) => {
          _.classList.add(this.toggleUnitIntervalState ? "show" : "hide");
        });
      });

      this.toggleUnitIntervalFunction();
    }, this.sensorListConfig.toggleUnitInterval ?? this.config.toggleUnitInterval ?? 3000);
  },

  renderSensorData(layout) {
    return new Promise((resolve) => {
      this.nunjucksEnvironment().render(
        this.getTemplate(layout),
        this.getTemplateData(),
        (err, res) => {
          if (err) {
            Log.error("Failed to render data", err);
          }
          this.updateDom(this.config.animationSpeed);

          this.toggleUnitIntervalState = false;
          let toggleUnitIntervalEnabled =
            this.sensorListConfig.toggleUnitInterval ??
            this.config.toggleUnitInterval ??
            false;
          if (toggleUnitIntervalEnabled) this.toggleUnitIntervalFunction();
          resolve(res);
        }
      );
    });
  },

  async socketNotificationReceived(notification, payload) {
    if (!payload.config || payload.config.moduleId !== this.config.moduleId)
      return;

    this.sensorListConfig = payload.sensorListConfig;
    this.sensorProperties = payload.sensorProperties;
    this.errors = payload.errors;

    switch (notification) {
      case "ERROR":
        this.avgs = null;
        this.avgsFiltered = null;
        await this.renderSensorData("error");
        break;
      case "UPDATE_SENSOR_DATA":
        this.avgs = payload.avgs;
        this.chartData = payload.chartData;
        this.avgsFiltered = payload.avgsFiltered;
        this.minVals = payload.minVals;
        this.maxVals = payload.maxVals;
        this.avg48Vals = payload.avg48Vals;
        this.latestVals = payload.latestVals;
        await this.renderSensorData(
          this.sensorListConfig?.layout ?? "list-horizontal"
        );
        this.renderGraphs();
        break;
      default:
        break;
    }
    this.updateDom(this.config.animationSpeed);
  },

  renderGraphs() {
    setTimeout(() => {
      const sensors = this.sensorListConfig.sensors;

      const min = d3.min(
        sensors
          .map((sensor) => this.chartData.day[sensor.id])
          .map((_) => d3.min(_?.radiation.values, (_) => _.uSvphAvg))
      );
      const max = d3.max(
        sensors
          .map((sensor) => this.chartData.day[sensor.id])
          .map((_) => d3.max(_?.radiation.values, (_) => _.uSvphAvg))
      );

      sensors.forEach((sensor) => {
        const listElement = d3.select(
          `#${this.identifier} .sensorlist-item[data-sensor="${sensor.id}"]`
        );
        if (!listElement.node()) return;

        const data = this.chartData.day[sensor.id].radiation.values.map((_) => {
          _._id = new Date(_._id);
          return _;
        });
        if (!data) return;

        const width = 100;
        const height = 100;

        listElement.select("svg").remove();

        const svg = listElement
          .append("svg")
          .lower()
          .attr("preserveAspectRatio", `none`)
          .attr("viewBox", `0 ${min} ${width} ${height}`);

        var x = d3
          .scaleTime()
          .domain(
            d3.extent(data, function (d) {
              return d._id;
            })
          )
          .range([0, width]);

        var y = d3.scaleLinear().domain([min, max]).range([height, 0]);

        svg
          .append("linearGradient")
          .attr("id", "line-gradient")
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", 0)
          .attr("y1", y(min))
          .attr("x2", 0)
          .attr("y2", y(max))
          .selectAll("stop")
          .data([
            { offset: "0%", color: "blue" },
            { offset: "100%", color: "red" }
          ])
          .enter()
          .append("stop")
          .attr("offset", function (d) {
            return d.offset;
          })
          .attr("stop-color", function (d) {
            return d.color;
          });

        svg
          .append("path")
          .datum(data)
          .attr("fill", "none")
          .attr("stroke", "url(#line-gradient)")
          .attr("stroke-width", 2)
          .attr(
            "d",
            d3
              .line()
              .x(function (d) {
                return x(d._id);
              })
              .y(function (d) {
                return y(d.uSvphAvg);
              })
          );
      });
    }, 1000);
  },

  isAcceptableSender(sender) {
    if (!sender) return true;
    const acceptableSender = this.config.events.sender ?? this.identifier;
    return (
      !acceptableSender ||
      acceptableSender === sender.name ||
      acceptableSender === sender.identifier ||
      (Array.isArray(acceptableSender) &&
        (acceptableSender.includes(sender.name) ||
          acceptableSender.includes(sender.identifier)))
    );
  },

  notificationReceived: function (notification, payload, sender) {
    if (!this.isAcceptableSender(sender)) return;

    this.config.events[notification]?.split(" ").forEach((e) => {
      switch (e) {
        case "SENSOR_LIST_ITEM_PREVIOUS":
          if (!this.hidden)
            this.sendSocketNotification("GET_PREVIOUS_SENSOR_LIST_ITEM", {
              config: this.config
            });
          break;
        case "SENSOR_LIST_ITEM_NEXT":
          if (!this.hidden)
            this.sendSocketNotification("GET_NEXT_SENSOR_LIST_ITEM", {
              config: this.config
            });
          break;
        case "SENSOR_LIST_ITEM_RANDOM":
          if (!this.hidden)
            this.sendSocketNotification("GET_RANDOM_SENSOR_LIST_ITEM", {
              config: this.config
            });
          break;
        default:
          break;
      }
    });
  },

  suspend: function () {
    this.suspended = true;
    this.sendSocketNotification("SUSPEND", { config: this.config });
  },

  resume: function () {
    if (this.suspended === false) return;
    this.suspended = false;
    this.sendSocketNotification("RESUME", { config: this.config });
  }
});
