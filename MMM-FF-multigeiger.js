/* MagicMirror²
 * Module: MMM-FF-multigeiger
 *
 * By Michael Trenkler
 * ISC Licensed.
 */

Module.register("MMM-FF-multigeiger", {
  defaults: {
    baseURL: "https://multigeiger.citysensor.de/",
    header: "Multigeiger",
    showTitle: true,
    sequence: "default",
    updateInterval: 15 * 60 * 1000,
    updateOnSuspension: null,
    animationSpeed: 1000,
    layout: "list-horizontal",
    type: "day",
    chartColors: "default",
    toggleUnitInterval: 10 * 1000,
    sensorList: [],
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

  NOW: "now",
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  FORWARDS: "forwards",
  BACKWARDS: "backwards",

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
    this.config.sensorList.forEach((_, idx) => (_.__id = idx));
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
    if (!this.config.showTitle || this.sensorListConfig?.showTitle === false)
      return null;

    const type = this.sensorListConfig?.type ?? this.config.type;
    let TYPE = (
      this.sensorListConfig?.type ??
      this.config.type ??
      ""
    ).toUpperCase();

    if (this.config?.startTime === this.NOW) {
      return `${this.sensorListConfig?.header ?? this.config.header}${
        type ? " - " + this.translate("CURRENT_" + TYPE) : ""
      }`;
    }

    const end = d3.timeFormat(this.translate("HEADER_DATE_FORMAT_END"))(
      this.config?.startTime
    );

    if (type === this.DAY) {
      return `${this.config.header} - ${this.translate(TYPE)} (${end})`;
    }

    const begin = d3.timeFormat(this.translate("HEADER_DATE_FORMAT_BEGIN"))(
      this.getFirstDayOfCurrentDateRange()
    );

    return `${this.config.header} - ${this.translate(
      TYPE
    )} (${begin} - ${end})`;
  },

  getTemplate(layout) {
    layout =
      layout ||
      (this.sensorListConfig?.layout ??
        this.config.layout ??
        "list-horizontal");

    if (this.errors?.length) {
      layout = "error";
    }

    return `templates/${layout}.njk`;
  },

  getTemplateData() {
    let dataComplete = true;

    const sensors = this.sensorListConfig?.sensors?.map((sensor) => {
      // preserve config order
      sensor.avg = this.avgsFiltered?.filter((_) => sensor.id === _.id)[0];
      sensor.properties = this.sensorProperties[sensor.id];
      dataComplete = dataComplete && sensor.avg && sensor.properties;

      sensor.chartData = this.chartData[sensor.id];
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

  getFirstDayOfCurrentDateRange() {
    const DAY = 24 * 60 * 60 * 1000;
    const dateRangeVals = {
      day: 1,
      week: 7,
      month: 30
    };

    const rangeType =
      this.sensorListConfig?.type ?? this.config?.type ?? this.DAY;

    const date =
      this.config.startTime === this.NOW ? new Date() : this.config.startTime;

    return new Date(
      (date?.valueOf() ?? Date.now()) - dateRangeVals[rangeType] * DAY
    );
  },

  getLastDayOfNextDateRange() {
    const DAY = 24 * 60 * 60 * 1000;
    const dateRangeVals = {
      day: 1,
      week: 7,
      month: 30
    };

    const rangeType =
      this.sensorListConfig?.type ?? this.config?.type ?? this.DAY;

    const date =
      this.config.startTime === this.NOW ? new Date() : this.config.startTime;

    return new Date(
      (date?.valueOf() ?? Date.now()) + dateRangeVals[rangeType] * DAY
    );
  },

  setStartTime(val) {
    let date;

    if (val === undefined) {
      if (!this.config.startTime || this.config.startTime === this.NOW) {
        this.config.startTime = this.NOW;
        return;
      }
    }

    date =
      this.config.startTime === this.NOW ? new Date() : this.config.startTime;

    switch (val) {
      case this.BACKWARDS:
        date = this.getFirstDayOfCurrentDateRange();
        date.setHours(24, 0, 0, -1);
        break;
      case this.FORWARDS:
        date = this.getLastDayOfNextDateRange();
        date.setHours(24, 0, 0, -1);
        if (date.valueOf() > Date.now()) {
          this.config.startTime = this.NOW;
          return;
        }
        break;
      case this.NOW:
        this.config.startTime = this.NOW;
        return;
      default:
        break;
    }
    this.config.startTime = date;
  },

  toggleUnitIntervalFunction() {
    if (this.toggleUnitInterval) clearTimeout(this.toggleUnitInterval);

    this.toggleUnitInterval = setTimeout(
      () => {
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
      },
      this.sensorListConfig.toggleUnitInterval ??
        this.config.toggleUnitInterval ??
        3000
    );
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

          this.toggleUnitIntervalState = false;
          if (this.toggleUnitInterval) clearTimeout(this.toggleUnitInterval);
          let toggleUnitIntervalEnabled =
            this.sensorListConfig?.toggleUnitInterval ??
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
          this.sensorListConfig?.layout ??
            this.config?.layout ??
            "list-horizontal"
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
    for (let sensorId in data) {
      let vals = data[sensorId].radiation?.values;
      vals?.forEach((v, i) => {
        vals[i]._id = new Date(v._id);
      });
    }
    return data;
  },

  renderGraphs() {
    if ((this.sensorListConfig.layout ?? this.config.layout) === "charts")
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
    setTimeout(async () => {
      const sensors = this.sensorListConfig.sensors;

      const xMin = this.getFirstDayOfCurrentDateRange();

      const xMax =
        this.config.startTime === this.NOW ? new Date() : this.config.startTime;

      const yMin = 0;

      const yMax =
        d3.max(
          sensors
            .map((sensor) => this.chartData[sensor.id] ?? [])
            .map((_) => d3.max(_?.radiation?.values ?? [], (_) => _.uSvphAvg))
        ) ?? 0;

      const graphWrapper = d3.select(`#${this.identifier} .graph-wrapper`);
      if (!graphWrapper.node()) return;

      const marginTop = 50;
      const marginRight = 50;
      const marginBottom = 50;
      const marginLeft = 50;
      const width = graphWrapper.node().clientWidth;
      const height = graphWrapper.node().clientHeight;
      const xDomain = [xMin, xMax];
      const yDomain = [yMin, yMax];
      const xRange = [marginLeft, width - marginRight];
      const yRange = [height - marginBottom, marginTop];
      const x = d3.scaleTime().domain(xDomain).range(xRange);
      const y = d3.scaleLinear().domain(yDomain).range(yRange);

      const data = sensors
        .map((sensor) => this.chartData[sensor.id] ?? [])
        .map((d) =>
          d?.radiation?.values.filter((_) => _._id.valueOf() >= xMin.valueOf())
        );

      if (!data) return;

      const localFormat = this.translate("localFormats");

      var ua = d3.timeFormatLocale(localFormat);
      d3.timeFormatDefaultLocale(localFormat);

      const formatMillisecond = d3.timeFormat(".%L"),
        formatSecond = d3.timeFormat(":%S"),
        formatMinute = d3.timeFormat("%H:%M"),
        formatHour = d3.timeFormat("%H:%M"),
        formatDay = d3.timeFormat("%a %d."),
        formatWeek = d3.timeFormat("%b %d."),
        formatMonth = d3.timeFormat("%B"),
        formatYear = d3.timeFormat("%Y");

      function multiFormat(date) {
        return (
          d3.timeSecond(date) < date
            ? formatMillisecond
            : d3.timeMinute(date) < date
              ? formatSecond
              : d3.timeHour(date) < date
                ? formatMinute
                : d3.timeDay(date) < date
                  ? formatHour
                  : d3.timeMonth(date) < date
                    ? d3.timeWeek(date) < date
                      ? formatDay
                      : formatWeek
                    : d3.timeYear(date) < date
                      ? formatMonth
                      : formatYear
        )(date);
      }

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
        .tickFormat((d) => multiFormat(d))
        .tickSizeOuter(0);
      const yAxis = d3.axisLeft(yScale).ticks(height / 60, yFormat);

      svg
        .append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis)
        .attr("class", "chart-scale chart-scale-x");

      svg
        .append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis)
        .attr("class", "chart-scale chart-scale-y")
        .call((g) =>
          g
            .append("text")
            .attr("x", -marginLeft + 10)
            .attr("y", 40)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("µSv/h")
        );

      const chartColors = this.chartColorFn(this.sensorListConfig);

      svg
        .append("g")
        .attr("fill", "none")
        .selectAll("path")
        .data(data)
        .join("path")
        .attr("stroke-width", 1)
        .attr("stroke", (i, I) => chartColors(I))
        .join(
          (enter) =>
            enter
              .append("path")
              .attr("class", "chart-line")
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
              .style("opacity", 0)
              .transition()
              .delay((d, i, a) => {
                return i * 125;
              })
              .duration(1000)
              .style("opacity", 1)
              .duration(1000)
              .attr("d", (i, I) => {
                return d3
                  .line()
                  .x(function (d) {
                    return x(d._id);
                  })
                  .y(function (d) {
                    return y(d.uSvphAvg ?? 0);
                  })(i);
              })
              .selection()
        );
    }, this.config.animationSpeed ?? 1000);
  },

  renderListGraphs() {
    setTimeout(() => {
      const sensors = this.sensorListConfig.sensors;

      const xMin = this.getFirstDayOfCurrentDateRange();

      const xMax =
        this.config.startTime === this.NOW ? new Date() : this.config.startTime;

      const yMin =
        d3.min(
          sensors
            .map((sensor) => this.chartData[sensor.id] ?? [])
            .map((_) => d3.min(_?.radiation?.values ?? [], (_) => _.uSvphAvg))
        ) ?? 0;
      const yMax =
        d3.max(
          sensors
            .map((sensor) => this.chartData[sensor.id] ?? [])
            .map((_) => d3.max(_?.radiation?.values ?? [], (_) => _.uSvphAvg))
        ) ?? 0;

      const width = 100;
      const height = 100;
      const x = d3.scaleUtc().domain([xMin, xMax]).range([0, width]);
      const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

      sensors.forEach((sensor) => {
        const listElement = d3.select(
          `#${this.identifier} .sensorlist-item[data-sensor="${sensor.id}"]`
        );
        if (!listElement.node()) return;

        const data = this.chartData[sensor.id]?.radiation?.values;

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
          .attr("class", "chart-line")
          .datum(data)
          .attr(
            "d",
            d3
              .line()
              .x(function (d) {
                return x(d._id);
              })
              .y(function (d) {
                return y(d.uSvphAvg ?? 0);
              })
          );
      });
    }, this.config.animationSpeed ?? 1000);
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

  flushSensorListConfig() {
    this.config.sensorList[this.sensorListConfig.__id] = this.sensorListConfig;
  },

  notificationReceived: function (notification, payload, sender) {
    if (!this.isAcceptableSender(sender)) return;

    this.config.events[notification]?.split(" ").forEach((e) => {
      this.setStartTime();
      const dateRangeTypes = [this.DAY, this.WEEK, this.MONTH];
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
            this.setStartTime(this.BACKWARDS);
            this.sendSocketNotification("UPDATE_CONFIG", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_DATE_NOW":
          if (!this.hidden) {
            this.setStartTime(this.NOW);
            this.sendSocketNotification("UPDATE_CONFIG", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_DATE_FORWARDS":
          if (!this.hidden) {
            this.setStartTime(this.FORWARDS);
            this.sendSocketNotification("UPDATE_CONFIG", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_DATE_RANGE_ZOOM_IN":
          if (!this.hidden) {
            this.config.type = this.sensorListConfig.type =
              dateRangeTypes[
                (dateRangeTypes.length +
                  dateRangeTypes.indexOf(
                    this.sensorListConfig.type ?? this.config.type
                  ) -
                  1) %
                  dateRangeTypes.length
              ];
            this.flushSensorListConfig();
            this.sendSocketNotification("UPDATE_CONFIG", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_DATE_RANGE_ZOOM_OUT":
          if (!this.hidden) {
            this.config.type = this.sensorListConfig.type =
              dateRangeTypes[
                (dateRangeTypes.length +
                  dateRangeTypes.indexOf(
                    this.sensorListConfig.type ?? this.config.type
                  ) +
                  1) %
                  dateRangeTypes.length
              ];
            this.flushSensorListConfig();
            this.sendSocketNotification("UPDATE_CONFIG", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_LAYOUT_PREVIOUS":
          if (!this.hidden) {
            this.config.layout = this.sensorListConfig.layout =
              layoutTypes[
                (layoutTypes.length +
                  layoutTypes.indexOf(
                    this.sensorListConfig.layout ?? this.config.layout
                  ) -
                  1) %
                  layoutTypes.length
              ];
            this.flushSensorListConfig();
            this.sendSocketNotification("UPDATE_CONFIG", {
              config: this.config
            });
          }
          break;
        case "SENSOR_LIST_LAYOUT_NEXT":
          if (!this.hidden) {
            this.config.layout = this.sensorListConfig.layout =
              layoutTypes[
                (layoutTypes.length +
                  layoutTypes.indexOf(
                    this.sensorListConfig.layout ?? this.config.layout
                  ) +
                  1) %
                  layoutTypes.length
              ];
            this.flushSensorListConfig();
            this.sendSocketNotification("UPDATE_CONFIG", {
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
