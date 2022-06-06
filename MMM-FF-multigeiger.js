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
        type: "24hours",
        layout: "list-horizontal",
        showAddress: false,
        showGraph: true,
        showInstallationSite: true,
        showRegion: true,
        showSensorId: true,
        showMinMax: true,
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
        type: "24hours",
        layout: "list-horizontal",
        showAddress: true,
        showGraph: false,
        showInstallationSite: true,
        showRegion: true,
        showSensorId: true,
        showMinMax: true,
        sensors: [
          { id: 31122, description: "Stuttgart" },
          { id: 59328, description: "Bern" },
          { id: 70948, description: "Nürnberg" },
          { id: 65059, description: "Hamburg" }
        ]
      },
      {
        description: "Radiation Augsburg",
        weight: 1,
        type: "24hours",
        layout: "charts",
        showAddress: true,
        showGraph: true,
        showInstallationSite: true,
        showRegion: true,
        showSensorId: true,
        showMinMax: true,
        sensors: [{ id: 72366, description: "Augsburg" }]
      }
    ],
    layout: "list-horizontal",
    chartColors: "default", // "default", color or array of colors ["#f00", "#0f0", "#00f" ...]
    sequence: "default", // null, 'random', 'default', 'reverse'
    updateOnSuspension: null, // null, false or true
    updateInterval: 15 * 60 * 1000,
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
    this.setStartTime();
    this.sendSocketNotification("GET_INITIAL_SENSOR_DATA", {
      config: this.config
    });
  },

  getScripts: function () {
    return [
      this.file("node_modules/d3/dist/d3.js"),
      this.file("node_modules/d3-format/dist/d3-format.js")
    ];
  },

  getStyles: function () {
    return [this.file("./styles/MMM-FF-multigeiger.css")];
  },

  getHeader: function () {
    if (!this.config.showTitle) return null;
    if (!this.avgs) return this.config.header;
    return `${this.config.header} ${this.translate(
      this.sensorListConfig?.type ?? this.config.type ?? ""
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
      colorFn: this.chartColorFn(this.sensorListConfig),
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

  dateToW3CString(date) {
    return d3
      .timeFormat("%Y-%m-%dT%H:%M:%S%Z")(date)
      .replace(/(\d\d)$/, ":$1");
  },

  setStartTime(val) {
    const DAY = 24 * 60 * 60 * 1000;
    const dateRangeVals = {
      "24hours": 1,
      "week": 7,
      "month": 30
    }
    let date;
    switch (val) {
      case "backwards":
        date = new Date(this.config.startTime?.valueOf() + dateRangeVals[this.config.type]);
        date.setHours(0);
        date.setMinutes(0);
        break;
      case "forward":
        date = new Date(this.config.startTime?.valueOf() + dateRangeVals[this.config.type]);
        if (date.valueOf() > Date.now()) {
          date = new Date();
        } else {
          date.setHours(0);
          date.setMinutes(0);
        }
        break;
      case "now":
        date = new Date();
        break;
      default:
        if (val !== undefined) {
          date = val;
        } else {
          date = new Date()
        }
        break;
    }
    this.config.startTime = this.dateToW3CString(date);
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
        this.chartData = this.transformChartData(payload.chartData);
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
  transformChartData(data) {
    // transform Date strings to Date objects
    for (let type in data) {
      const typeData = data[type];
      for (let sensorId in typeData) {
        vals = typeData[sensorId].radiation?.values;
        vals?.forEach((v, i) => {
          vals[i]._id = new Date(v._id);
        });
      }
    }
    return data;
  },

  renderGraphs() {
    if (this.sensorListConfig.layout === "charts")
      return this.renderChartGraphs();
    if (this.sensorListConfig.showGraph == false) return;
    this.renderListGraphs();
  },

  chartColorFn(sheetListConfig) {
    const colorTheme =
      sheetListConfig?.chartColors ?? this.config.chartColors ?? "default";

    if (Array.isArray(colorTheme)) {
      return (i) => {
        colorTheme[i % colorTheme.length];
      };
    } else if (/#([0-9a-f]{3}){1,2}/i.test(colorTheme)) {
      return () => colorTheme;
    } else {
      // default
      return d3.scaleOrdinal(d3.schemeCategory10);
    }
  },

  renderChartGraphs() {
    setTimeout(() => {
      const sensors = this.sensorListConfig.sensors;

      const xMin = d3.min(
        sensors
          .map((sensor) => this.chartData.day[sensor.id] ?? [])
          .map((_) =>
            d3.min(_?.radiation?.values ?? [], (_) => new Date(_._id))
          )
      );
      const xMax = d3.max(
        sensors
          .map((sensor) => this.chartData.day[sensor.id] ?? [])
          .map((_) =>
            d3.max(_?.radiation?.values ?? [], (_) => new Date(_._id))
          )
      );

      const yMin = 0; //
      // d3.min(
      //   sensors
      //     .map((sensor) => this.chartData.day[sensor.id] ?? [])
      //     .map((_) => d3.min(_?.radiation?.values ?? [], (_) => _.uSvphAvg))
      // );

      const yMax = d3.max(
        sensors
          .map((sensor) => this.chartData.day[sensor.id] ?? [])
          .map((_) => d3.max(_?.radiation?.values ?? [], (_) => _.uSvphAvg))
      );

      const graphWrapper = d3.select(`#${this.identifier} .graph-wrapper`);
      if (!graphWrapper.node()) return;

      const marginTop = 50;
      const marginRight = 50;
      const marginBottom = 50;
      const marginLeft = 50;
      const width = graphWrapper.node().getBoundingClientRect().width;
      const height = graphWrapper.node().getBoundingClientRect().height;
      const xDomain = [xMin, xMax];
      const yDomain = [yMin, yMax];
      const xRange = [marginLeft, width - marginRight];
      const yRange = [height - marginBottom, marginTop];
      const x = d3.scaleTime().domain(xDomain).range(xRange);
      const y = d3.scaleLinear().domain(yDomain).range(yRange);

      const data = sensors
        .map((sensor) => this.chartData.day[sensor.id] ?? [])
        .map((d) =>
          d?.radiation?.values.map((v) => {
            v._id = v._id;
            return v;
          })
        );

      if (!data) return;

      graphWrapper.select("svg").remove();

      const svg = graphWrapper
        .append("svg")
        .lower()
        .attr("preserveAspectRatio", `none`)
        .attr("viewBox", `0 ${yMin} ${width} ${height}`);

      const xScale = d3.scaleTime(xDomain, xRange);
      const yScale = d3.scaleLinear(yDomain, yRange);
      const yFormat = 10;
      const xAxis = d3
        .axisBottom(xScale)
        .ticks(width / 80, d3.timeFormat("%H:%M"))
        .tickSizeOuter(0);
      const yAxis = d3.axisLeft(yScale).ticks(height / 60, yFormat);

      svg
        .append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis);

      svg
        .append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .call((g) =>
          g
            .append("text")
            .attr("x", -marginLeft + 10)
            .attr("y", 40)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("µSv/h")
        );

      const line = d3
        .line()
        .curve(d3.curveLinear)
        .x(function (d) {
          return x(d._id);
        })
        .y(function (d) {
          return y(d.uSvphAvg);
        });

      const chartColors = this.chartColorFn(this.sensorListConfig);

      const path = svg
        .append("g")
        .attr("fill", "none")
        .attr("stroke", "#f00")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 1)
        .selectAll("path")
        .data(data)
        .join("path")
        .attr("stroke-width", 2)
        .attr("stroke", (i, I) => chartColors(I))
        .join(
          (enter) =>
            enter
              .append("path")
              .attr("fill", "none")
              .attr("stroke", "#0f0")
              .attr("stroke-width", 1.5)

              .attr("d", (i, I) => {
                return d3
                  .line()
                  .x(function (d) {
                    return x(d._id);
                  })
                  .y(function (d) {
                    return y(0);
                  })(i);
              })
              .style("opacity", 0)
              .transition()
              .delay(1000)
              .duration(1000)
              .style("opacity", 1)
              .selection(),
          (update) =>
            update
              .attr("d", (i, I) => {
                return d3
                  .line()
                  .x(function (d) {
                    return x(d._id);
                  })
                  .y(function (d) {
                    return y(0);
                  })(i);
              })
              .transition()
              .delay((d, i, a) => {
                return i * 125;
              })
              .duration(1000)
              .attr("d", (i, I) => {
                return d3
                  .line()
                  .x(function (d) {
                    return x(d._id);
                  })
                  .y(function (d) {
                    return y(d.uSvphAvg);
                  })(i);
              })
              .selection()
        );
    }, 1000);
  },

  renderListGraphs() {
    setTimeout(() => {
      const sensors = this.sensorListConfig.sensors;

      const xMin = d3.min(
        sensors
          .map((sensor) => this.chartData.day[sensor.id] ?? [])
          .map((_) => d3.min(_?.radiation?.values ?? [], (_) => _._id))
      );
      const xMax = d3.max(
        sensors
          .map((sensor) => this.chartData.day[sensor.id] ?? [])
          .map((_) => d3.max(_?.radiation?.values ?? [], (_) => _._id))
      );

      const yMin = d3.min(
        sensors
          .map((sensor) => this.chartData.day[sensor.id] ?? [])
          .map((_) => d3.min(_?.radiation?.values ?? [], (_) => _.uSvphAvg))
      );
      const yMax = d3.max(
        sensors
          .map((sensor) => this.chartData.day[sensor.id] ?? [])
          .map((_) => d3.max(_?.radiation?.values ?? [], (_) => _.uSvphAvg))
      );

      const width = 100;
      const height = 100;
      const x = d3.scaleUtc().domain([xMin, xMax]).range([0, width]);
      const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

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

        listElement.select("svg").remove();

        const svg = listElement
          .select(".graph-wrapper")
          .append("svg")
          .lower()
          .attr("preserveAspectRatio", `none`)
          .attr("viewBox", `0 ${yMin} ${width} ${height}`);

        svg
          .append("linearGradient")
          .attr("id", "line-gradient")
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", 0)
          .attr("y1", y(yMin))
          .attr("x2", 0)
          .attr("y2", y(yMax))
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
    if (!sender) return false;
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
      this.setStartTime();
      const dateRangeTypes = ["24hours", "week", "month"];
      const layoutTypes = ["list-vertical", "list-horizontal", "charts"];
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
        case "SENSOR_LIST_DATE_BACKWARDS":
          if (!this.hidden) {
            this.setStartTime("backwards");
            this.sendSocketNotification("UPDATE_SENSOR_LIST_ITEM", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_DATE_NOW":
          if (!this.hidden) {
            this.setStartTime("now");
            this.sendSocketNotification("UPDATE_SENSOR_LIST_ITEM", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_DATE_FORWARDS":
          if (!this.hidden) {
            this.setStartTime("forwards");
            this.sendSocketNotification("UPDATE_SENSOR_LIST_ITEM", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_DATE_RANGE_ZOOM_IN":
          if (!this.hidden) {
            this.config.type = dateRangeTypes[ (dateRangeTypes.length + --dateRangeTypes.indexOf(this.config.type) -1 ) % dateRangeTypes.length ];
            this.sendSocketNotification("UPDATE_SENSOR_LIST_ITEM", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_DATE_RANGE_ZOOM_OUT":
            if (!this.hidden) {
            this.config.type = dateRangeTypes[ (dateRangeTypes.length + dateRangeTypes.indexOf(this.config.type) +1 ) % dateRangeTypes.length ];
            this.sendSocketNotification("UPDATE_SENSOR_LIST_ITEM", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_LAYOUT_PREVIOUS":
            if (!this.hidden) {
            this.config.layout = layoutTypes[ (layoutTypes.length + layoutTypes.indexOf(this.config.type) -1 ) % layoutTypes.length ];
            this.sendSocketNotification("UPDATE_SENSOR_LIST_ITEM", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_LAYOUT_NEXT":
            if (!this.hidden) {
            this.config.layout = layoutTypes[ (layoutTypes.length + layoutTypes.indexOf(this.config.type) +1 ) % layoutTypes.length ];
            this.sendSocketNotification("UPDATE_SENSOR_LIST_ITEM", {
              config: this.config
            });
          }
          break;
        default:
          break;
      }
    });
  },

  suspend: function () {
    this.suspended = true;
    this.setStartTime();
    this.sendSocketNotification("SUSPEND", { config: this.config });
  },

  resume: function () {
    if (this.suspended === false) return;
    this.suspended = false;
    this.setStartTime();
    this.sendSocketNotification("RESUME", { config: this.config });
  }
});
