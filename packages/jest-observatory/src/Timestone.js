let { sortBy } = require("lodash");

const Original_Date = Date;

const Mock_Date = Object.assign(
  function(value = Mock_Date.now()) {
    return new Original_Date(value);
  },
  {
    mocked_current_time: null,
    now: () => {
      if (Mock_Date.active) {
        const time = Mock_Date.mocked_current_time;
        Mock_Date.mocked_current_time = time + 1;
        return time;
      } else {
        return Original_Date.now();
      }
    },

    UTC: Original_Date.UTC,
    prototype: Original_Date.prototype,
    __original: Original_Date,
  }
);

/*:flow
type TTimer = {
  id: number,
  type: 'interval' | 'timeout' | 'immediate',
  projected_time: number, // timestamp it is supposed to have it's next run
  duration: number, // Necessary for interval to repeat
  fn_to_execute: () => mixed,
};
*/

class TimeStone {
  constructor(obj) {
    this.initial_id = 1;
    this.mocked_timers = [] /*: Array<TTimer>*/;
    this.active = false;

    // this.mocked_nextTicks = [];

    this.mocks = {
      setInterval: (_setInterval) => (fn, duration) => {
        this.mocked_timers.push({
          id: this.initial_id,
          type: "interval",
          projected_time: Date.now() + duration,
          duration: duration,
          fn_to_execute: () => {
            // Reschedule the interval so it will run again
            setInterval(fn, duration);
            fn();
          },
        });
        this.initial_id = this.initial_id + 1;
        return this.initial_id;
      },
      setImmediate: (_setImmediate) => (fn) => {
        fn();
        // this.mocked_nextTicks.push({
        //   fn: fn,
        // });
      },
      setTimeout: (_setTimeout) => (fn, duration) => {
        this.mocked_timers.push({
          id: this.initial_id,
          type: "timeout",
          projected_time: Date.now() + duration,
          duration: duration,
          fn_to_execute: fn,
        });
        this.initial_id = this.initial_id + 1;
        return this.initial_id;
      },
      clearTimeout: (_clearTimeout) => (id) => {
        this.mocked_timers = this.mocked_timers.filter((x) => x.id !== id);
      },
      clearInterval: (_clearInterval) => (id) => {
        this.mocked_timers = this.mocked_timers.filter((x) => x.id !== id);
      },
    };

    this.original_functions = {};
    Object.entries(this.mocks).forEach(([key, mockFn]) => {
      if (typeof mockFn !== "function") {
        throw new Error(`MockFn not a function (key: '${key}')`);
      }

      this.original_functions[key] = obj[key];
      const with_original = mockFn(obj[key]);
      obj[key] = (...args) => {
        if (this.active) {
          return with_original(...args);
        } else {
          return this.original_functions[key](...args);
        }
      };
      obj[key].__original = this.original_functions[key];
    });
  }

  activate(base_time) {
    this.active = true;
    Mock_Date.active = true;
    Mock_Date.mocked_current_time = Number(base_time);
  }
  deactivate() {
    this.active = false;
    Mock_Date.active = false;

    this.mocked_timers = [];
    this.initial_id = 1;
  }

  async mock_forward_time(to_date, time_changed_callback) {
    // Get the first timer that we need
    let timers_coming_up = this.mocked_timers.filter(
      (timer) => timer.projected_time <= to_date
    );
    let timers = sortBy(timers_coming_up, (x) => x.projected_time);

    let current_timer = timers[0];
    if (current_timer) {
      // Remove current timer from the timers now already,
      // because we might get confused when there are timers added during the
      // execution of the current_timer
      this.mocked_timers = this.mocked_timers.filter((x) => x !== current_timer);

      // Set the current time to the point where the timer would run,
      // and then execute the timer!
      let last_mocked_time = Mock_Date.mocked_current_time;
      Mock_Date.mocked_current_time = current_timer.projected_time;
      if (typeof time_changed_callback === 'function') {
        time_changed_callback({
          from: last_mocked_time,
          to: Mock_Date.mocked_current_time
        });
      }
      current_timer.fn_to_execute();

      // Try to resolve all the async/await statements inside by calling a real setImmediate.
      // NOTE This should be the only real setImmediate call inside the program, so would be last thing to run.
      // TODO If this does not resolve all of them, maybe do something with `process._getActiveRequests()`
      await new Promise((yell) => {
        this.original_functions.setImmediate(() => {
          yell();
        });
      });

      // Retry this method, either executing the next timer or ending
      return this.mock_forward_time(to_date, time_changed_callback);
    } else {
      // Send last time change to the callback
      if (typeof time_changed_callback === 'function') {
        time_changed_callback({
          from: Mock_Date.mocked_current_time,
          to: to_date.getTime(),
        });
      }
      // Update the current time and end
      Mock_Date.mocked_current_time = to_date.getTime();
    }
  }
}

// Just in case this module gets re-required
if (global.Date.__timestone__) {
  module.exports = { TimeStone, timestone: global.Date.__timestone__ };
} else {
  global.Date = Mock_Date;
  let timestone = new TimeStone(global);
  global.Date.__timestone__ = timestone
  module.exports = { TimeStone, timestone }
}
